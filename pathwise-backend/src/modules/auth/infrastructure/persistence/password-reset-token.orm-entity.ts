import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * An outstanding password-reset token.
 *
 * `tokenHash` is a SHA-256 of the token, never the token. The token is 32
 * random bytes handed to exactly one person; the row is what an attacker gets
 * from a database dump, and it has to be worthless to them. (SHA-256 rather
 * than bcrypt: bcrypt's cost exists to slow guessing at a low-entropy secret,
 * and there is nothing to guess at in 256 bits of randomness.)
 *
 * Unique, because a hash collision would hand one person another's account.
 *
 * Like refresh_tokens, expiry is stored rather than enforced by the store, so
 * every read must check it. A row outliving its token is the normal state
 * until something deletes it.
 */
@Entity({ name: 'password_reset_tokens' })
export class PasswordResetTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  tokenHash: string;

  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
