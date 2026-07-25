import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'referral_codes' })
export class ReferralCodeOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}

@Entity({ name: 'referral_redemptions' })
export class ReferralRedemptionOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Index()
  @Column({ type: 'uuid' })
  referrerUserId: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  newUserId: string; // one redemption per new user

  @Column({ type: 'int' })
  rewardDays: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
