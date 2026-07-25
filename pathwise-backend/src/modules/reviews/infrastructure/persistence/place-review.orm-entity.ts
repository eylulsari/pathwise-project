import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/** A real user review for a place (Phase 3). One review per user+place. */
@Entity({ name: 'place_reviews' })
@Unique(['userId', 'placeId'])
export class PlaceReviewOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  authorName: string;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  placeId: string;

  @Column({ type: 'int' })
  rating: number; // 1–5

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'int', default: 0 })
  helpfulCount: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
