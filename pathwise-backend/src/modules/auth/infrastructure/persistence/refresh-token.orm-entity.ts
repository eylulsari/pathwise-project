import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

/**
 * A live refresh-token identifier (JTI).
 *
 * Previously kept in Redis, where the TTL expired rows for us. Postgres does
 * not, so `expiresAt` is stored explicitly and **every read must check it** —
 * a row outliving its token is not an error here, it is the normal state
 * until something cleans it up.
 *
 * The upside of the move: sessions now survive a backend restart. In Redis
 * they did not, which on a free-tier host that sleeps meant users were
 * silently logged out.
 */
@Entity({ name: 'refresh_tokens' })
// One row per (user, jti). The JTI is a uuid, so this is really a uniqueness
// guarantee rather than a lookup shape — it stops a replayed save from
// creating duplicates.
@Unique(['userId', 'jti'])
export class RefreshTokenOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 64 })
  jti: string;

  // Checked on every validation; also what the opportunistic cleanup prunes by.
  @Index()
  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
