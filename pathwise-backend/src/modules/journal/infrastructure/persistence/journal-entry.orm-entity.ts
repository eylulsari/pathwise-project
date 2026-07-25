import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity({ name: 'trip_journal_entries' })
@Unique(['userId', 'placeId'])
export class JournalEntryOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 120 })
  placeId: string;

  @Column({ type: 'text', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'int' })
  rating: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
