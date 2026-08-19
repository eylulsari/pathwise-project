import { Logger } from '@nestjs/common';
import { NarrationService, narrationLang } from './narration.service';
import type { ConfigService } from '@nestjs/config';
import type { Repository } from 'typeorm';
import type { GroqClient } from '../../assistant/infrastructure/groq/groq.client';
import type { EnrichmentService } from './enrichment.service';
import type { NarrationCacheOrmEntity } from '../infrastructure/persistence/narration-cache.orm-entity';

/**
 * The narration is model-written, so its wording cannot be asserted. What is
 * worth asserting is what the service refuses to return: nothing invented for
 * a place with no article, and nothing that renamed the place.
 */

const wiki = {
  title: 'Ayasofya',
  summary: 'Ayasofya is a mosque in the Fatih district of Istanbul, built 532–537.',
  url: 'https://tr.wikipedia.org/wiki/Ayasofya',
};

function build(opts: {
  enrichment?: unknown;
  generate?: () => Promise<{ text: string }>;
  cacheRow?: Partial<NarrationCacheOrmEntity> | null;
  configured?: boolean;
  /** Make the cache itself fail, as a missing table or dead pool would. */
  cacheBroken?: boolean;
}) {
  const saved: Partial<NarrationCacheOrmEntity>[] = [];
  const generate = jest.fn(opts.generate ?? (() => Promise.resolve({ text: '' })));

  const service = new NarrationService(
    {
      get: (key: string) =>
        opts.configured === false
          ? undefined
          : key === 'GROQ_API_KEY'
            ? 'test-key'
            : 'test-model',
    } as unknown as ConfigService,
    { generate } as unknown as GroqClient,
    {
      getEnrichment: () =>
        Promise.resolve(opts.enrichment ?? { wikipedia: wiki, osm: null }),
    } as unknown as EnrichmentService,
    {
      count: () =>
        opts.cacheBroken
          ? Promise.reject(new Error('relation "narration_cache" does not exist'))
          : Promise.resolve(0),
      findOne: () =>
        opts.cacheBroken
          ? Promise.reject(new Error('relation "narration_cache" does not exist'))
          : Promise.resolve(opts.cacheRow ?? null),
      save: (row: Partial<NarrationCacheOrmEntity>) => {
        if (opts.cacheBroken) {
          return Promise.reject(new Error('relation "narration_cache" does not exist'));
        }
        saved.push(row);
        return Promise.resolve(row);
      },
    } as unknown as Repository<NarrationCacheOrmEntity>,
  );

  return { service, generate, saved };
}

/** 160 words of plausible narration, with the name spelled as the source has it. */
const goodScript = `Ayasofya stands in Fatih. ${'It was built between 532 and 537. '.repeat(12)}`;

describe('NarrationService', () => {
  it('returns nothing for a place with no Wikipedia article', async () => {
    const { service, generate } = build({ enrichment: { wikipedia: null, osm: null } });

    expect(await service.forPlace('p1', 'en')).toBeNull();
    // The model is never even asked: there is no grounding to ask it with,
    // and a narration written from the place's name alone is the invention
    // this feature exists to avoid.
    expect(generate).not.toHaveBeenCalled();
  });

  it('discards a script that renamed the place', async () => {
    // What the model actually did when asked for Arabic: translated the name.
    const { service, saved } = build({
      generate: () => Promise.resolve({ text: 'أيا صوفيا هو مسجد في إسطنبول.' }),
    });

    expect(await service.forPlace('p1', 'ar')).toBeNull();
    // And it is not cached, so the next request gets a fresh attempt rather
    // than the rejected one served forever.
    expect(saved).toHaveLength(0);
  });

  it('keeps and caches a script that kept the name', async () => {
    const { service, saved } = build({
      generate: () => Promise.resolve({ text: goodScript }),
    });

    const result = await service.forPlace('p1', 'en');
    expect(result?.script).toContain('Ayasofya');
    expect(result?.sourceTitle).toBe('Ayasofya');
    expect(saved).toEqual([
      { placeId: 'p1', lang: 'en', script: goodScript.trim(), sourceTitle: 'Ayasofya' },
    ]);
  });

  it('serves the cache without calling the model', async () => {
    const { service, generate } = build({
      cacheRow: { script: goodScript, sourceTitle: 'Ayasofya' },
    });

    expect((await service.forPlace('p1', 'en'))?.script).toBe(goodScript);
    expect(generate).not.toHaveBeenCalled();
  });

  it('ignores a cached script written from a different article', async () => {
    // The article behind it was replaced, so the script is no longer a
    // rewording of anything current.
    const { service, generate } = build({
      cacheRow: { script: 'stale', sourceTitle: 'Hagia Sophia' },
      generate: () => Promise.resolve({ text: goodScript }),
    });

    expect((await service.forPlace('p1', 'en'))?.script).toBe(goodScript.trim());
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('stays silent, rather than failing the page, when generation throws', async () => {
    const { service } = build({ generate: () => Promise.reject(new Error('429')) });
    expect(await service.forPlace('p1', 'en')).toBeNull();
  });

  it('stays silent when no key is configured', async () => {
    const { service, generate } = build({ configured: false });
    expect(await service.forPlace('p1', 'en')).toBeNull();
    expect(generate).not.toHaveBeenCalled();
  });
});

describe('narrationLang', () => {
  it('accepts the six languages the UI offers', () => {
    for (const l of ['en', 'tr', 'de', 'es', 'ru', 'ar']) {
      expect(narrationLang(l)).toBe(l);
    }
  });

  it('reads the primary subtag, so a browser tag still lands somewhere real', () => {
    expect(narrationLang('de-AT')).toBe('de');
    expect(narrationLang('AR-EG')).toBe('ar');
  });

  it('falls back to English for anything else', () => {
    expect(narrationLang('ja')).toBe('en');
    expect(narrationLang(undefined)).toBe('en');
    expect(narrationLang('')).toBe('en');
  });
});

/**
 * The bug this feature actually shipped with: `narration_cache` had no
 * migration, so production had no table. Every read threw, the throw was
 * logged at warn and folded into "cache miss", and the endpoint kept answering
 * 200 while paying for a fresh narration on every single open. Nothing failed,
 * so nobody looked.
 *
 * These hold the line that a cache which cannot be consulted is reported as a
 * fault, and never presented as a normal cold read.
 */
describe('NarrationService — a broken cache is not a cache miss', () => {
  it('says so at boot, loudly, instead of waiting to be noticed', async () => {
    const { service } = build({ cacheBroken: true });
    const logged: string[] = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((msg: unknown) => void logged.push(String(msg)));

    await service.onModuleInit();

    expect(logged).toHaveLength(1);
    expect(logged[0]).toMatch(/narration_cache is not queryable/);
    // The operator is told what it costs and what to check, not just that
    // something went wrong.
    expect(logged[0]).toMatch(/billed/);
    expect(logged[0]).toMatch(/migration/i);
    jest.restoreAllMocks();
  });

  it('logs a failed read at error level, not warn', async () => {
    const { service } = build({
      cacheBroken: true,
      generate: () => Promise.resolve({ text: goodScript }),
    });
    const errors: string[] = [];
    const warnings: string[] = [];
    jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation((msg: unknown) => void errors.push(String(msg)));
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((msg: unknown) => void warnings.push(String(msg)));

    await service.forPlace('p1', 'en');

    expect(errors.some((e) => /READ FAILED/.test(e))).toBe(true);
    // And it says outright that this is not a miss, because that confusion is
    // the entire defect.
    expect(errors.some((e) => /not a cache miss/i.test(e))).toBe(true);
    expect(warnings.some((w) => /cache/i.test(w))).toBe(false);
    jest.restoreAllMocks();
  });

  it('still serves the traveller a narration — degraded, not broken', async () => {
    const { service } = build({
      cacheBroken: true,
      generate: () => Promise.resolve({ text: goodScript }),
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    const result = await service.forPlace('p1', 'en');
    expect(result?.script).toContain('Ayasofya');
    // Freshly generated, and it says so.
    expect(result?.fromCache).toBe(false);
    jest.restoreAllMocks();
  });

  it('reports the degradation for as long as it lasts', async () => {
    const { service } = build({
      cacheBroken: true,
      generate: () => Promise.resolve({ text: goodScript }),
    });
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

    expect(service.isCacheUsable()).toBe(true); // nothing tried yet
    await service.forPlace('p1', 'en');
    expect(service.isCacheUsable()).toBe(false);
    jest.restoreAllMocks();
  });

  it('marks a served cache hit as one, and a fresh generation as not', async () => {
    const hit = build({ cacheRow: { script: goodScript, sourceTitle: 'Ayasofya' } });
    expect((await hit.service.forPlace('p1', 'en'))?.fromCache).toBe(true);

    const cold = build({ generate: () => Promise.resolve({ text: goodScript }) });
    expect((await cold.service.forPlace('p1', 'en'))?.fromCache).toBe(false);
  });
});

/**
 * The second silent failure, found while proving the first was fixed.
 *
 * The model is a reasoning model whose thinking tokens are charged against the
 * same budget as the answer, so it intermittently returns HTTP 200 with
 * `finish_reason: "length"` and an empty string — about one call in three
 * against the real Ayasofya extract. That used to become a bare `return null`,
 * which is the same answer this service gives for a place with no Wikipedia
 * article at all.
 */
describe('NarrationService — an empty generation is not a missing article', () => {
  it('retries once, because the condition is intermittent', async () => {
    let calls = 0;
    const { service } = build({
      generate: () => {
        calls += 1;
        return Promise.resolve(
          calls === 1 ? { text: '', finishReason: 'length' } : { text: goodScript },
        );
      },
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    const result = await service.forPlace('p1', 'en');
    expect(calls).toBe(2);
    expect(result?.script).toContain('Ayasofya');
    jest.restoreAllMocks();
  });

  it('says the model produced nothing, and says why', async () => {
    const { service } = build({
      generate: () => Promise.resolve({ text: '', finishReason: 'length' }),
    });
    const warnings: string[] = [];
    jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation((msg: unknown) => void warnings.push(String(msg)));

    expect(await service.forPlace('p1', 'en')).toBeNull();

    expect(warnings.some((w) => /came back EMPTY/.test(w))).toBe(true);
    // The reason the model gave is in the line, so the cause is diagnosable
    // from logs alone rather than by reproducing it by hand.
    expect(warnings.some((w) => /finish_reason=length/.test(w))).toBe(true);
    // And it explicitly rules out the reading that cost a day of confusion.
    expect(warnings.some((w) => /not a place without an article/i.test(w))).toBe(true);
    jest.restoreAllMocks();
  });

  it('gives up after two empties rather than looping', async () => {
    let calls = 0;
    const { service } = build({
      generate: () => {
        calls += 1;
        return Promise.resolve({ text: '', finishReason: 'length' });
      },
    });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});

    expect(await service.forPlace('p1', 'en')).toBeNull();
    expect(calls).toBe(2);
    jest.restoreAllMocks();
  });
});
