import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Outstanding password-reset tokens.
 *
 * `tokenHash` holds a SHA-256 of the token and never the token itself, so a
 * dump of this table is not a set of account takeovers. It is unique because a
 * collision would hand one person another's account.
 *
 * No foreign key to `users`, matching the rest of this schema.
 */
export class CreatePasswordResetTokens1730000012000 implements MigrationInterface {
  name = 'CreatePasswordResetTokens1730000012000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'password_reset_tokens',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'tokenHash', type: 'varchar', length: '64', isNullable: false },
          { name: 'expiresAt', type: 'timestamptz', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_hash',
        columnNames: ['tokenHash'],
        isUnique: true,
      }),
    );
    // Revoking every token a user holds is a normal step of a completed reset.
    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_user',
        columnNames: ['userId'],
      }),
    );
    // Expiry is checked on every read and pruned on every write.
    await queryRunner.createIndex(
      'password_reset_tokens',
      new TableIndex({
        name: 'IDX_password_reset_tokens_expires',
        columnNames: ['expiresAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('password_reset_tokens', true);
  }
}
