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
      findOne: () => Promise.resolve(opts.cacheRow ?? null),
      save: (row: Partial<NarrationCacheOrmEntity>) => {
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
