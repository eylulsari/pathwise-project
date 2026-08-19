import { Injectable, Logger } from '@nestjs/common';
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
}

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
export class NarrationService {
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
    if (cached) return { script: cached, lang, sourceTitle: wiki.title };

    const apiKey = this.config.get<string>('GROQ_API_KEY');
    const model = this.config.get<string>('GROQ_MODEL');
    if (!apiKey || !model) {
      // Configured off. Not an error — the panel simply does not appear, the
      // same as a place with no article.
      this.logger.debug('GROQ_API_KEY not set — narration unavailable');
      return null;
    }

    let script: string;
    try {
      const result = await this.groq.generate({
        apiKey,
        model,
        systemInstruction: this.prompt(lang),
        contents: [
          {
            role: 'user',
            parts: [{ text: `Title: ${wiki.title}\n\nExtract:\n${wiki.summary}` }],
          },
        ],
      });
      script = result.text.trim();
    } catch (err) {
      // A narration is a nice-to-have on a detail panel; a failed generation
      // must degrade to "no player", never to a broken page.
      this.logger.warn(`Narration generation failed for ${placeId}: ${String(err)}`);
      return null;
    }

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
    return { script, lang, sourceTitle: wiki.title };
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

  private async readCache(
    placeId: string,
    lang: string,
    sourceTitle: string,
  ): Promise<string | null> {
    try {
      const row = await this.cache.findOne({ where: { placeId, lang } });
      // A script written from a different article version is stale — the
      // article is the whole basis for it.
      if (row && row.sourceTitle === sourceTitle) return row.script;
    } catch (err) {
      this.logger.warn(`Narration cache read failed for ${placeId}: ${String(err)}`);
    }
    return null;
  }

  private async writeCache(
    placeId: string,
    lang: string,
    script: string,
    sourceTitle: string,
  ): Promise<void> {
    try {
      await this.cache.save({ placeId, lang, script, sourceTitle });
    } catch (err) {
      // Swallowed: a cache that cannot be written is a slower feature, not a
      // broken one. The narration just generated is still returned.
      this.logger.warn(`Narration cache write failed for ${placeId}: ${String(err)}`);
    }
  }
}
