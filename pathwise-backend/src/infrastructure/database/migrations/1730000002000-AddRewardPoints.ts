import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Reward points (Phase 3): a balance on `users` plus the ledger that explains
 * it. The balance is denormalised on purpose — the UI reads it off a row it
 * already loads — but it must stay reconstructable from `point_transactions`,
 * which is append-only.
 */
export class AddRewardPoints1730000002000 implements MigrationInterface {
  name = 'AddRewardPoints1730000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "points" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "point_transactions" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "action" character varying(32) NOT NULL,
        "points" integer NOT NULL,
        "reference" character varying(120),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_point_transactions" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_point_transactions_userId" ON "point_transactions" ("userId")`,
    );
    // The throttle lookup and the profile list both read "this user, newest
    // first" — one composite index serves both.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_point_transactions_userId_createdAt" ON "point_transactions" ("userId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "point_transactions"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "points"`);
  }
}
