import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

export interface PollOption {
  id: string;
  placeId: string;
  label: string;
  votes: number;
}

@Entity({ name: 'polls' })
export class PollOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  creatorUserId: string;

  @Column({ type: 'varchar', length: 200 })
  question: string;

  @Column({ type: 'jsonb' })
  options: PollOption[];

  @Column({ type: 'varchar', length: 10, default: 'open' })
  status: 'open' | 'closed';

  @Column({ type: 'varchar', length: 120, nullable: true })
  winnerPlaceId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'poll_votes' })
@Unique(['pollId', 'userId'])
export class PollVoteOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  pollId: string;

  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 40 })
  optionId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
