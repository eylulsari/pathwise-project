import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Records an affiliate/partner link click — the base for commission tracking. */
@Entity({ name: 'affiliate_clicks' })
export class AffiliateClickOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index()
  @Column({ type: 'varchar', length: 120 })
  tourId: string;

  @Column({ type: 'varchar', length: 40 })
  source: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
