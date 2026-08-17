import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/**
 * Wikipedia lead extracts and photo URLs, kept across restarts.
 *
 * There was already an in-process cache with a thirty-day TTL, and inside one
 * long-lived process it does the job. Two things it cannot do: survive a
 * restart, and be shared by a second instance. The deployment target sleeps
 * when idle, so in practice every cold start re-fetched all of it — and
 * Wikipedia answers a burst with 429, measured here at twelve refusals out of
 * twenty-five requests spaced a quarter-second apart. A traveller opening
 * places one at a time never sees that; a service waking up and filling a cold
 * cache is exactly the shape that does.
 *
 * One row per place rather than per article: the same article can be mapped to
 * more than one place, and the lookup this serves is always by placeId.
 *
 * Summary and photo live in one row because one request returns both. Storing
 * them apart would mean two rows written from a single response and the chance
 * of holding a photo whose summary had been evicted.
 */
@Entity({ name: 'wikipedia_cache' })
export class WikipediaCacheOrmEntity {
  @PrimaryColumn({ type: 'varchar', length: 120 })
  placeId: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  /**
   * Already trimmed to a sentence boundary by the client before it is stored.
   * Trimming on write rather than on read means the rule is applied once, and
   * changing it is a deliberate act — a cache refill — rather than something
   * that silently reshapes text that has already been shown to people.
   */
  @Column({ type: 'text' })
  summary: string;

  @Column({ type: 'text', nullable: true })
  thumbnailUrl: string | null;

  @Column({ type: 'text' })
  pageUrl: string;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
