import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the three opt-in women-traveler preference columns to users.
 *
 * ⚠️ These hold a **self-declaration**, not a verified attribute — no identity
 * check of any kind backs them (see the `SafetyPreferences` note in the domain
 * model). `identifiesAsWoman` is intentionally NULLABLE with no default:
 * NULL means "not stated", which must stay distinguishable from an explicit
 * `false`, and no existing user is assigned a gender by this migration.
 *
 * TODO(verification): a future real verification mechanism (e.g. an ID check)
 * must add its own column/table rather than reinterpreting these values.
 */
export class AddWomenTravelerPreferencesToUsers1730000001000
  implements MigrationInterface
{
  name = 'AddWomenTravelerPreferencesToUsers1730000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "identifiesAsWoman" boolean`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "visibleToWomenOnly" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "showWomenOnly" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "showWomenOnly"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "visibleToWomenOnly"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "identifiesAsWoman"`);
  }
}
