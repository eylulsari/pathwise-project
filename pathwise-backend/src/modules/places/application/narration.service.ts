import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GroqClient } from '../../assistant/infrastructure/groq/groq.client';
import { EnrichmentService } from './enrichment.service';
import { NarrationCacheOrmEntity } from '../infrastructure/persistence/narration-cache.orm-entity';

/** The languages the UI offers. Anything else falls back to English. */
const SUPPORTED = ['en', 'tr', 'de', 'es', 'ru', 'ar'] as const;
export type NarrationLang = (typeof SUPPORTED)[number];

const LANGUAGE_NAME: Record<NarrationLang, string> = {
  en: 'English',
  tr: 'Turkish',
  de: 'German',
  es: 'Spanish',
  ru: 'Russian',
  ar: 'Arabic',
};

export interface Narration {
  script: string;
  lang: NarrationLang;
  /** Where the facts came from — shown as attribution, never hidden. */
  sourceTitle: string;
  /**
   * Whether this came out of the cache or was just generated.
   *
   * Reported because a cache that has silently stopped working looks exactly
   * like a cache that is merely cold: the feature keeps answering, and the
   * only difference is a paid API call on every open that nobody notices.
   * This makes the difference observable from outside the process.
   */
  fromCache: boolean;
}

/**
 * A cache lookup has three outcomes, not two.
 *
 * `miss` means "not stored yet" and is normal. `unavailable` means the cache
 * itself could not be consulted — a missing table, a dead connection — and is
 * a fault. Collapsing the second into the first is what let this feature run
 * in production for a full deploy with no cache at all: the reads threw, the
 * error was logged at warn and discarded, and every request paid for a fresh
 * narration while the endpoint kept returning 200.
 */
type CacheRead =
  | { status: 'hit'; script: string }
  | { status: 'miss' }
  | { status: 'unavailable' };

export const narrationLang = (raw: string | undefined): NarrationLang => {
  const primary = (raw ?? '').toLowerCase().split('-')[0];
  return (SUPPORTED as readonly string[]).includes(primary)
    ? (primary as NarrationLang)
    : 'en';
};

/**
 * A short spoken guide for a place, written from its Wikipedia lead.
 *
 * WHY THE SUMMARY AND NOT THE MODEL'S OWN KNOWLEDGE
 * The prompt hands the model the article extract and tells it to work only
 * from that. A language model asked to describe Ayasofya from memory will
 * produce something fluent, confident and occasionally wrong — dates, who
 * built what, which century — and a wrong fact delivered in a calm narrator's
 * voice is the least questionable form a wrong fact can take. Grounding it in
 * the extract makes the narration a rewording of a citable source, and the
 * source is named in the response so the traveller can check it.
 *
 * WHY NO AUDIO FILE
 * This returns TEXT. The client speaks it with the browser's own speech
 * synthesis, which costs nothing, needs no object storage (this project has
 * none — even journal photo upload is still a stub), works offline once the
 * script is cached, and lets the traveller pick their own voice and speed.
 * Producing and storing MP3s would add a storage bill and a delivery problem
 * for something every browser already does.
 *
 * WHAT IT REFUSES TO DO
 * Invent. A place with no Wikipedia article gets `null`, and the UI shows no
 * player at all — rather than a narration assembled from the place's name and
 * category, which is the tempting version and the dishonest one.
 */
@Injectable()
export class NarrationService implements OnModuleInit {
  private readonly logger = new Logger(NarrationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly groq: GroqClient,
    private readonly enrichment: EnrichmentService,
    @InjectRepository(NarrationCacheOrmEntity)
    private readonly cache: Repository<NarrationCacheOrmEntity>,
  ) {}

  async forPlace(placeId: string, lang: NarrationLang): Promise<Narration | null> {
    const enriched = await this.enrichment.getEnrichment(placeId);
    const wiki = enriched.wikipedia;
    // No article → no narration. See the note above: this is the case the
    // feature must stay quiet for, not paper over.
    if (!wiki?.summary) return null;

    const cached = await this.readCache(placeId, lang, wiki.title);
    if (cached.status === 'hit') {
      return { script: cached.script, lang, sourceTitle: wiki.title, fromCache: true };
    }

    const apiKey = this.config.get<string>('GROQ_API_KEY');
    const model = this.config.get<string>('GROQ_MODEL');
    if (!apiKey || !model) {
      // Configured off. Not an error — the panel simply does not appear, the
      // same as a place with no article.
      this.logger.debug('GROQ_API_KEY not set — narration unavailable');
      return null;
    }

    const script = await this.generate(placeId, lang, wiki.title, wiki.summary);
    if (!script) return null;

    /**
     * Verify the place name survived, rather than trusting the instruction.
     *
     * The prompt tells the model not to translate or transliterate the name,
     * and the model does it anyway: asked for Arabic, it returned "أيا صوفيا"
     * for a place the rest of the app — and every sign in Sultanahmet — calls
     * Ayasofya. Phase 4 went to some trouble to stop the UI renaming places
     * per language, and a narration that renames them in speech undoes it for
     * the one surface a traveller might be repeating out loud.
     *
     * So the script has to contain the name as spelled at least once. If it
     * does not, the narration is dropped rather than shipped: no player is a
     * smaller failure than a confident voice using a name nobody there would
     * recognise. Logged, because it is worth knowing how often this happens.
     */
    if (!script.includes(wiki.title)) {
      this.logger.warn(
        `Narration for ${placeId} (${lang}) dropped the place name "${wiki.title}" — discarded`,
      );
      return null;
    }

    await this.writeCache(placeId, lang, script, wiki.title);
    return { script, lang, sourceTitle: wiki.title, fromCache: false };
  }

  /**
   * Ask the model for a script, and refuse to lose the answer quietly.
   *
   * The model behind this is a reasoning model, and its thinking tokens are
   * charged against the same `max_tokens` budget as the answer. When the
   * thinking runs long the budget is gone before any prose is produced, and
   * the call returns HTTP 200 with `finish_reason: "length"` and an empty
   * string. Measured against the real Ayasofya extract, that happened on
   * roughly one call in three.
   *
   * The old code turned that into `return null`, with no log line at all —
   * and `null` is the same answer this service gives for a place that has no
   * Wikipedia article. So a place with a perfectly good article intermittently
   * showed no audio guide, and nothing anywhere said why. That is the failure
   * this whole round is about, so: it is logged with the reason the model
   * gave, and retried once, because the condition is intermittent rather than
   * permanent.
   */
  private async generate(
    placeId: string,
    lang: NarrationLang,
    title: string,
    summary: string,
  ): Promise<string | null> {
    const apiKey = this.config.get<string>('GROQ_API_KEY')!;
    const model = this.config.get<string>('GROQ_MODEL')!;

    for (let attempt = 1; attempt <= 2; attempt++) {
      let result: { text: string; finishReason?: string };
      try {
        result = await this.groq.generate({
          apiKey,
          model,
          systemInstruction: this.prompt(lang),
          contents: [
            {
              role: 'user',
              parts: [{ text: `Title: ${title}\n\nExtract:\n${summary}` }],
            },
          ],
        });
      } catch (err) {
        // A narration is a nice-to-have on a detail panel; a failed call must
        // degrade to "no player", never to a broken page. Rate limits land
        // here, and they are worth seeing.
        this.logger.warn(
          `Narration generation failed for ${placeId} (${lang}), attempt ${attempt}: ${String(err)}`,
        );
        return null;
      }

      const script = result.text.trim();
      if (script) return script;

      this.logger.warn(
        `Narration for ${placeId} (${lang}) came back EMPTY on attempt ${attempt} ` +
          `(finish_reason=${result.finishReason ?? 'unknown'}). This is not a place ` +
          `without an article — the model produced no text.`,
      );
    }

    this.logger.warn(
      `Narration for ${placeId} (${lang}) gave up after 2 empty generations — no player shown.`,
    );
    return null;
  }

  /**
   * The instruction. Explicit about length because "short" is not a length,
   * and explicit about invention because that is the failure that matters.
   */
  private prompt(lang: NarrationLang): string {
    return [
      `You write short audio-guide narrations for travellers in Istanbul.`,
      `Write in ${LANGUAGE_NAME[lang]}, and only in ${LANGUAGE_NAME[lang]}.`,
      `Length: 150 to 220 words — about 60 to 90 seconds when read aloud.`,
      `Use ONLY facts present in the extract you are given. Do not add dates,`,
      `names, figures or events from your own knowledge, even if you are`,
      `confident they are correct. If the extract is thin, write a shorter`,
      `narration rather than filling it out with anything unsupported.`,
      `Keep the place's name exactly as the extract spells it — do not`,
      `translate or transliterate it.`,
      `Write flowing prose meant to be heard, not a list. No headings, no`,
      `bullet points, no markdown, and no meta-commentary about the extract.`,
    ].join(' ');
  }

  /**
   * Say once, at boot, whether the cache is usable at all.
   *
   * This is the check whose absence cost a deploy. `narration_cache` had no
   * migration, so production ran with no table; every request threw inside
   * readCache, the throw was logged at warn and folded into "cache miss", and
   * the feature went on answering 200 while paying for a fresh narration each
   * time. Nothing in the logs said the word "missing", and nothing failed.
   *
   * A single ERROR line at startup turns that into something a person can see
   * without going looking. It deliberately does not throw: a broken cache is a
   * slower feature, not a reason to refuse to serve the whole app.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.cache.count();
    } catch (err) {
      this.cacheUsable = false;
      this.logger.error(
        `narration_cache is not queryable — every narration will be regenerated and billed. ` +
          `Has the migration run? Cause: ${String(err)}`,
      );
    }
  }

  /**
   * Hit, miss, or "could not ask" — three outcomes, never two.
   *
   * The `unavailable` branch logs at ERROR, not warn, because it is a fault in
   * infrastructure rather than an ordinary cold read, and it is the exact case
   * that hid for a whole deploy behind a warn-level line.
   */
  private async readCache(
    placeId: string,
    lang: string,
    sourceTitle: string,
  ): Promise<CacheRead> {
    try {
      const row = await this.cache.findOne({ where: { placeId, lang } });
      if (!row) return { status: 'miss' };
      // A script written from a different article version is stale — the
      // article is the whole basis for it.
      if (row.sourceTitle !== sourceTitle) return { status: 'miss' };
      return { status: 'hit', script: row.script };
    } catch (err) {
      this.cacheUsable = false;
      this.logger.error(
        `Narration cache READ FAILED for ${placeId} (${lang}) — this is not a cache ` +
          `miss, the cache could not be consulted: ${String(err)}`,
      );
      return { status: 'unavailable' };
    }
  }

  /**
   * Returns whether the script was actually stored.
   *
   * A failed write is still not fatal — the narration just generated is
   * returned either way — but it is reported rather than absorbed, so a cache
   * that has stopped accepting writes cannot masquerade as one that is simply
   * always cold.
   */
  private async writeCache(
    placeId: string,
    lang: string,
    script: string,
    sourceTitle: string,
  ): Promise<boolean> {
    try {
      await this.cache.save({ placeId, lang, script, sourceTitle });
      this.cacheUsable = true;
      return true;
    } catch (err) {
      this.cacheUsable = false;
      this.logger.error(
        `Narration cache WRITE FAILED for ${placeId} (${lang}) — the next request ` +
          `for this place will be billed again: ${String(err)}`,
      );
      return false;
    }
  }

  /** Whether the cache has worked since the last time it was touched. */
  private cacheUsable = true;

  /** Read by the health endpoint, so the degradation is visible from outside. */
  isCacheUsable(): boolean {
    return this.cacheUsable;
  }
}
