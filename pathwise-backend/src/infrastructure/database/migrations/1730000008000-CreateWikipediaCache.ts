import { MigrationInterface, QueryRunner, Table } from 'typeorm';

/**
 * Persistent cache for Wikipedia lead extracts and photo URLs.
 *
 * Purely derived data: dropping this table costs a refetch and nothing else,
 * which is why it carries no foreign key to places (the catalogue is an
 * in-memory dataset, not a table) and no constraints beyond the primary key.
 */
export class CreateWikipediaCache1730000008000 implements MigrationInterface {
  name = 'CreateWikipediaCache1730000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'wikipedia_cache',
        columns: [
          { name: 'placeId', type: 'varchar', length: '120', isPrimary: true },
          { name: 'title', type: 'varchar', length: '200', isNullable: false },
          { name: 'summary', type: 'text', isNullable: false },
          { name: 'thumbnailUrl', type: 'text', isNullable: true },
          { name: 'pageUrl', type: 'text', isNullable: false },
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
    await queryRunner.dropTable('wikipedia_cache', true);
  }
}
