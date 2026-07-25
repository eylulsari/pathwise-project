import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * TypeORM persistence entity for the `users` table. Kept separate from the
 * domain `User` so the domain stays framework-free (Clean Architecture).
 */
@Entity({ name: 'users' })
export class UserOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  passwordHash: string;

  @Column({ type: 'varchar', length: 80, nullable: true })
  nationality: string | null;

  @Column({ type: 'int', nullable: true })
  age: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  travelStyles: string[];

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  // Feature-flag tier. Migration: AddSubscriptionTierToUsers (dev auto-syncs).
  @Column({ type: 'varchar', length: 16, default: 'free' })
  subscriptionTier: 'free' | 'premium' | 'trial';

  // Trial/reward premium window (referral B2 + trial A6).
  @Column({ type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
