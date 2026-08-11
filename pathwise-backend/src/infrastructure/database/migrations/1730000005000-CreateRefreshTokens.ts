import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Refresh-token identifiers, moved out of Redis.
 *
 * Redis is being removed from the project entirely (a managed instance costs
 * money on the free hosting tier this deploys to), so the one piece of real
 * state it held gets a table. Everything else it did — caches and quotas — is
 * in-process now.
 *
 * `expiresAt` is explicit because Postgres has no TTL: the store must compare
 * it on every read, and rows outlive their tokens until something prunes them.
 * The repository prunes a user's dead rows when it writes a new one, which
 * avoids a scheduler.
 *
 * NOTE: this migration does not backfill. Any session live at deploy time is
 * dropped, because its JTI only ever existed in Redis — affected users simply
 * sign in again.
 */
export class CreateRefreshTokens1730000005000 implements MigrationInterface {
  name = 'CreateRefreshTokens1730000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "jti" character varying(64) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_refresh_tokens" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_refresh_tokens_user_jti" UNIQUE ("userId", "jti")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_userId" ON "refresh_tokens" ("userId")`,
    );
    // Validation and the opportunistic prune both filter on expiry.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_expiresAt" ON "refresh_tokens" ("expiresAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "refresh_tokens"`);
  }
}
