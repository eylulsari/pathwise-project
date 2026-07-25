import { MigrationInterface, QueryRunner } from 'typeorm';

/** Adds the premium feature-flag column to users. */
export class AddSubscriptionTierToUsers1730000000000
  implements MigrationInterface
{
  name = 'AddSubscriptionTierToUsers1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "subscriptionTier" character varying(16) NOT NULL DEFAULT 'free'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "subscriptionTier"`);
  }
}
