import { Column, Entity, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';

/**
 * Exactly one working plan per user, enforced by the unique constraint rather
 * than by the service remembering to check. Every edit rewrites `days`, so a
 * second row would be an invisible fork of someone's trip.
 */
@Entity({ name: 'user_plans' })
@Unique(['userId'])
export class PlanOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  /**
   * The dashboard's days: per day the hub and pace config, the explicit stop
   * order the user dragged into place, pinned reservations, and the computed
   * itinerary.
   *
   * The order and the itinerary are both stored on purpose. The order is the
   * edit — it is what the next rebuild replays. The itinerary is a cache, so
   * reopening the dashboard paints the plan immediately instead of firing one
   * rebuild per day and showing spinners for a plan that has not changed.
   */
  @Column({ type: 'jsonb' })
  days: unknown;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
