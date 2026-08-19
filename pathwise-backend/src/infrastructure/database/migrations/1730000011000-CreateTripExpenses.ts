import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

/**
 * Trip expenses — what a trip cost, and who owes whom afterwards.
 *
 * ⚠️ A ledger, not a payment rail. No amount here is ever moved; the group
 * settles up however they already do. See expenses.service.ts.
 *
 * Money is stored as `amountKurus`, a bigint in the smallest unit, because an
 * equal split of ₺10 three ways is 3.34 + 3.33 + 3.33 and a float column would
 * not keep the books closed. `enteredAmount` / `enteredCurrency` / `rateToTry`
 * preserve what was actually typed and the rate that priced it, so a dinner
 * entered as €40 stays €40 and the conversion stays checkable.
 *
 * No foreign key to `users`, matching the rest of this schema.
 */
export class CreateTripExpenses1730000011000 implements MigrationInterface {
  name = 'CreateTripExpenses1730000011000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'trip_expenses',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true, default: 'gen_random_uuid()' },
          { name: 'userId', type: 'uuid', isNullable: false },
          { name: 'dayIndex', type: 'int', isNullable: false },
          { name: 'category', type: 'varchar', length: '16', isNullable: false },
          { name: 'placeId', type: 'varchar', length: '128', isNullable: true },
          { name: 'placeName', type: 'varchar', length: '200', isNullable: true },
          { name: 'note', type: 'varchar', length: '200', isNullable: true },
          { name: 'amountKurus', type: 'bigint', isNullable: false },
          {
            name: 'enteredAmount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false,
          },
          { name: 'enteredCurrency', type: 'varchar', length: '3', isNullable: false },
          {
            name: 'rateToTry',
            type: 'numeric',
            precision: 14,
            scale: 6,
            isNullable: false,
          },
          { name: 'rateSource', type: 'varchar', length: '16', isNullable: false },
          { name: 'paidByUserId', type: 'uuid', isNullable: false },
          {
            name: 'participantIds',
            type: 'jsonb',
            isNullable: false,
            default: "'[]'::jsonb",
          },
          { name: 'createdAt', type: 'timestamptz', default: 'now()', isNullable: false },
        ],
      }),
      true,
    );

    // The ledger is always read one account at a time, and totalled per day.
    await queryRunner.createIndex(
      'trip_expenses',
      new TableIndex({
        name: 'IDX_trip_expenses_user_day',
        columnNames: ['userId', 'dayIndex'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('trip_expenses', 'IDX_trip_expenses_user_day');
    await queryRunner.dropTable('trip_expenses', true);
  }
}
