import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Buddy connections — the last user-generated state still living in the
 * browser's `localStorage`.
 *
 * `travelerId` is not a foreign key: travelers are a static in-memory seed
 * with no table behind them, so a constraint would point at nothing. The
 * service validates the id against the seed instead, the same way forum
 * answers and route likes do.
 *
 * The UNIQUE on (userId, travelerId) is the line that matters: it makes
 * "connected once" a guarantee rather than an intention, and lets the connect
 * endpoint be idempotent without a read-modify-write race.
 */
export class CreateBuddyConnections1730000006000 implements MigrationInterface {
  name = 'CreateBuddyConnections1730000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "buddy_connections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "travelerId" character varying(64) NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_buddy_connections" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_buddy_connections_user_traveler" UNIQUE ("userId", "travelerId")
      )
    `);
    // Every read is "who has this viewer connected with".
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_buddy_connections_userId" ON "buddy_connections" ("userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_buddy_connections_travelerId" ON "buddy_connections" ("travelerId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "buddy_connections"`);
  }
}
