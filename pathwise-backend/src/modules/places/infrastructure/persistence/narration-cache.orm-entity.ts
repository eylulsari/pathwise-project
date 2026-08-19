import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Generated audio-guide scripts, kept across restarts.
 *
 * Same reasoning as the Wikipedia cache next door, with a sharper edge: this
 * text costs a paid API call to produce, not just a public fetch. Regenerating
 * it on every open would bill for a narration the traveller has already heard,
 * and — because a language model is not deterministic — hand them a subtly
 * different script each time for a place whose facts have not changed.
 *
 * The key is (placeId, lang), not placeId. A narration is written IN a
 * language; caching by place alone would serve the German script to the reader
 * who switched to Arabic.
 */
@Entity({ name: 'narration_cache' })
export class NarrationCacheOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  placeId: string;

  /** BCP-47 primary subtag: en, tr, de, es, ru, ar. */
  @PrimaryColumn({ type: 'varchar', length: 8 })
  lang: string;

  /** The script itself — 60–90 seconds of speech, roughly 150–220 words. */
  @Column({ type: 'text' })
  script: string;

  /**
   * Which Wikipedia summary it was written from. If the article is refetched
   * and its lead has changed, the script it was derived from is stale, and
   * this is what lets that be noticed rather than assumed.
   */
  @Column({ type: 'varchar', length: 200 })
  sourceTitle: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
