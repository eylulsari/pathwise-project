import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PointAction } from '../../domain/points';

/**
 * Append-only reward-points ledger. Rows are never updated or deleted — the
 * balance on `users.points` must stay reconstructable from this table.
 */
@Entity({ name: 'point_transactions' })
// The throttle and the profile list both read "this user's rows, newest
// first", so index the pair rather than userId alone.
@Index(['userId', 'createdAt'])
export class PointTransactionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  action: PointAction;

  @Column({ type: 'int' })
  points: number;

  // Audit breadcrumb (tour id, place id, referral code…), not a foreign key.
  @Column({ type: 'varchar', length: 120, nullable: true })
  reference: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
