import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Direct messaging: connections between real accounts, blocks, and messages.
 *
 * No foreign keys to `users`, matching the rest of this schema: the tables
 * here outlive the accounts on purpose — a message that vanished when its
 * sender deleted their account would take the recipient's copy of the
 * conversation, and a report filed about it, with it.
 */
export class CreateMessaging1730000009000 implements MigrationInterface {
  name = 'CreateMessaging1730000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'user_connections',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'requesterId', type: 'uuid', isNullable: false },
          { name: 'addresseeId', type: 'uuid', isNullable: false },
          { name: 'status', type: 'varchar', length: '10', default: "'pending'" },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
          { name: 'respondedAt', type: 'timestamptz', isNullable: true },
        ],
        uniques: [
          {
            name: 'UQ_user_connections_pair',
            columnNames: ['requesterId', 'addresseeId'],
          },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'user_connections',
      new TableIndex({ name: 'IDX_user_connections_requester', columnNames: ['requesterId'] }),
    );
    await queryRunner.createIndex(
      'user_connections',
      new TableIndex({ name: 'IDX_user_connections_addressee', columnNames: ['addresseeId'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'user_blocks',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'blockerId', type: 'uuid', isNullable: false },
          { name: 'blockedId', type: 'uuid', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
        uniques: [
          { name: 'UQ_user_blocks_pair', columnNames: ['blockerId', 'blockedId'] },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'user_blocks',
      new TableIndex({ name: 'IDX_user_blocks_blocker', columnNames: ['blockerId'] }),
    );
    await queryRunner.createIndex(
      'user_blocks',
      new TableIndex({ name: 'IDX_user_blocks_blocked', columnNames: ['blockedId'] }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'direct_messages',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'senderId', type: 'uuid', isNullable: false },
          { name: 'recipientId', type: 'uuid', isNullable: false },
          // Text only — there is no attachment column to fill in later.
          { name: 'body', type: 'varchar', length: '2000', isNullable: false },
          { name: 'createdAt', type: 'timestamptz', default: 'now()' },
        ],
      }),
      true,
    );
    await queryRunner.createIndex(
      'direct_messages',
      new TableIndex({
        name: 'IDX_direct_messages_thread',
        columnNames: ['senderId', 'recipientId', 'createdAt'],
      }),
    );
    // Serves the daily send count, which reads by sender over a time window.
    await queryRunner.createIndex(
      'direct_messages',
      new TableIndex({
        name: 'IDX_direct_messages_sender_time',
        columnNames: ['senderId', 'createdAt'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('direct_messages', true);
    await queryRunner.dropTable('user_blocks', true);
    await queryRunner.dropTable('user_connections', true);
  }
}
