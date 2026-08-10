import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Persisted check-ins written by signed-in users. */
@Entity({ name: 'check_ins' })
// The feed reads "newest first" across all users, so index the sort column.
@Index(['createdAt'])
export class CheckInOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  // Denormalised on purpose: the feed is a historical record and should keep
  // saying who posted even if the account is later renamed or deleted.
  @Column({ type: 'varchar', length: 120 })
  authorName: string;

  @Column({ type: 'varchar', length: 280 })
  message: string;

  // Null when the author did not pick a place ("right here"). Not a foreign
  // key — places are a static in-memory dataset, not a table.
  @Column({ type: 'varchar', length: 120, nullable: true })
  placeId: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  hub: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
