import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Generated audio-guide scripts, kept across restarts.
 *
 * This table should have shipped with the narration feature and did not. Dev
 * runs with `synchronize: true`, so TypeORM created it locally and every gate
 * passed against a schema the migrations had never built — production, where
 * `DB_SYNCHRONIZE=false`, simply had no table. The cache reads were swallowing
 * the resulting error, so the only visible symptom was a feature that quietly
 * paid Groq for a fresh narration on every single open.
 *
 * Same reasoning as the Wikipedia cache next door, with a sharper edge: this
 * text costs a paid API call to produce. The key is (placeId, lang), not
 * placeId — a narration is written IN a language, and caching by place alone
 * would serve the German script to a reader who switched to Arabic.
 */
export class CreateNarrationCache1730000010000 implements MigrationInterface {
  name = 'CreateNarrationCache1730000010000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'narration_cache',
        columns: [
          { name: 'placeId', type: 'varchar', length: '120', isPrimary: true },
          // BCP-47 primary subtag: en, tr, de, es, ru, ar.
          { name: 'lang', type: 'varchar', length: '8', isPrimary: true },
          { name: 'script', type: 'text', isNullable: false },
          // Which Wikipedia summary it was written from, so a script derived
          // from a lead that has since changed can be noticed as stale.
          { name: 'sourceTitle', type: 'varchar', length: '200', isNullable: false },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('narration_cache', true);
  }
}
