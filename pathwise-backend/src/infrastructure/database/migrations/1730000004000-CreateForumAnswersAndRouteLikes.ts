import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The two social actions that were client-only: answering a forum thread, and
 * liking a community route.
 *
 * Neither `questionId` nor `routeId` is a foreign key — questions and routes
 * are static in-memory seeds, not tables (there is no UI to create either), so
 * a constraint would point at nothing. Both are validated against the seed in
 * the service layer instead.
 *
 * The UNIQUE on (userId, routeId) is the important line here: it is what makes
 * "one like per person" a guarantee rather than an intention, and what lets
 * the like endpoint be idempotent without a read-modify-write race. The
 * visible like count is a COUNT over this table plus a static demo baseline —
 * no total is stored anywhere, so nothing can drift.
 */
export class CreateForumAnswersAndRouteLikes1730000004000
  implements MigrationInterface
{
  name = 'CreateForumAnswersAndRouteLikes1730000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "forum_answers" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "questionId" character varying(64) NOT NULL,
        "userId" uuid NOT NULL,
        "authorName" character varying(120) NOT NULL,
        "text" character varying(1000) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_forum_answers" PRIMARY KEY ("id")
      )
    `);
    // Threads are read by question id.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_answers_questionId" ON "forum_answers" ("questionId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_forum_answers_userId" ON "forum_answers" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "route_likes" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "routeId" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_route_likes" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_route_likes_user_route" UNIQUE ("userId", "routeId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_likes_userId" ON "route_likes" ("userId")`,
    );
    // The feed counts likes per route on every read.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_likes_routeId" ON "route_likes" ("routeId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "route_likes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "forum_answers"`);
  }
}
