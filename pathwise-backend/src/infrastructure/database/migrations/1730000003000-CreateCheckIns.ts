import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Persisted check-ins (the feed's real half; the curated demo entries stay an
 * in-memory seed and are merged in at read time).
 *
 * `authorName` is denormalised rather than joined from `users`: the feed is a
 * historical record and should keep saying who posted even after a rename or
 * an account deletion.
 *
 * `placeId` is NOT a foreign key — places are a static in-memory dataset, not
 * a table — and is nullable because the composer collects a message only.
 */
export class CreateCheckIns1730000003000 implements MigrationInterface {
  name = 'CreateCheckIns1730000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "check_ins" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "authorName" character varying(120) NOT NULL,
        "message" character varying(280) NOT NULL,
        "placeId" character varying(120),
        "hub" character varying(40),
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_check_ins" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_check_ins_userId" ON "check_ins" ("userId")`,
    );
    // The feed reads newest-first across all users, so the sort column is
    // indexed on its own rather than as part of a per-user composite.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_check_ins_createdAt" ON "check_ins" ("createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "check_ins"`);
  }
}
