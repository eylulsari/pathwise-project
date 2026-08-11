import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * One row per (person, route) they like.
 *
 * The unique constraint is the feature, not a nicety: it is what makes a like
 * a toggle rather than a tally, and what lets the write path be idempotent
 * without a read-modify-write race. Un-liking deletes the row; the visible
 * count is always a COUNT over this table.
 */
@Entity({ name: 'route_likes' })
@Unique(['userId', 'routeId'])
export class RouteLikeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // NOT a foreign key: community routes are a static in-memory seed.
  @Index()
  @Column({ type: 'varchar', length: 64 })
  routeId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
