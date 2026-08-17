import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * One row per (person, place they bookmarked).
 *
 * The unique constraint makes the save button a toggle rather than a tally,
 * and lets the write path be idempotent without a read-modify-write race —
 * the same reasoning as `route_likes` and `buddy_connections`.
 */
@Entity({ name: 'saved_places' })
@Unique(['userId', 'placeId'])
export class SavedPlaceOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // NOT a foreign key: places are a static dataset compiled into the image.
  @Column({ type: 'varchar', length: 96 })
  placeId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
