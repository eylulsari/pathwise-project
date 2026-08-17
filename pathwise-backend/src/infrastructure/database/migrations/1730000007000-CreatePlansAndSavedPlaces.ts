import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two tables behind route editing.
 *
 * `user_plans` holds the plan a traveller is *working on*, one row per user.
 * Until now every edit — a dragged stop, a removed one, a pinned reservation —
 * lived only in React state, so a refresh silently rebuilt the plan from
 * scratch and threw the edits away. The UNIQUE on userId is what makes "one
 * working plan" a guarantee rather than an intention, and it lets the write be
 * an upsert instead of a read-modify-write that two rapid drags could race.
 *
 * `saved_places` is the bookmark list. `placeId` is not a foreign key —
 * places are a static dataset compiled into the image, not a table, so a
 * constraint would point at nothing; the service checks the catalogue instead.
 * The UNIQUE on (userId, placeId) makes the save button a toggle rather than a
 * tally, the same shape as `route_likes` and `buddy_connections`.
 */
export class CreatePlansAndSavedPlaces1730000007000 implements MigrationInterface {
  name = 'CreatePlansAndSavedPlaces1730000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "user_plans" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "days" jsonb NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_plans" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_plans_userId" UNIQUE ("userId")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "saved_places" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "placeId" character varying(96) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_saved_places" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_saved_places_user_place" UNIQUE ("userId", "placeId")
      )
    `);
    // Every read is "what has this viewer saved".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_saved_places_userId" ON "saved_places" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "saved_places"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_plans"`);
  }
}
