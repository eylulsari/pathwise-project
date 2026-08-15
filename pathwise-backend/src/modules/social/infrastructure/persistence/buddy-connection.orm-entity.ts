import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * One row per (person, traveler they connected with).
 *
 * The unique constraint makes the connect button a toggle rather than a tally,
 * and lets the write path be idempotent without a read-modify-write race —
 * the same reasoning as `route_likes`.
 */
@Entity({ name: 'buddy_connections' })
@Unique(['userId', 'travelerId'])
export class BuddyConnectionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // NOT a foreign key: travelers are a static in-memory seed, not a table.
  @Index()
  @Column({ type: 'varchar', length: 64 })
  travelerId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
