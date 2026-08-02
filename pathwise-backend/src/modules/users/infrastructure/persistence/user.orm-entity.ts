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

  // ── Opt-in women-traveler mode (self-declared, NOT verified) ──────
  // Migration: AddWomenTravelerPreferencesToUsers. See the ethical note on
  // `SafetyPreferences` in the domain model before touching these.
  // `null` here means "not stated" and is deliberately distinct from `false`,
  // so the column stays nullable — do not add a NOT NULL default.
  @Column({ type: 'boolean', nullable: true })
  identifiesAsWoman: boolean | null;

  @Column({ type: 'boolean', default: false })
  visibleToWomenOnly: boolean;

  @Column({ type: 'boolean', default: false })
  showWomenOnly: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
