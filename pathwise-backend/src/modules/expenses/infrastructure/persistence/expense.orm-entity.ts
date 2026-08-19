import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ExpenseCategory =
  | 'food'
  | 'tickets'
  | 'transport'
  | 'shopping'
  | 'other';

/**
 * One thing somebody paid for on a trip.
 *
 * WHAT IS STORED AND WHY
 * The ledger works in kuruş (`amountKurus`), but what the traveller typed is
 * kept beside it: the amount, the currency and the rate used at the time. A
 * dinner entered as €40 stays €40 in the record. Re-deriving it later from
 * today's rate would silently rewrite what somebody actually paid, and the
 * conversion would stop being checkable.
 *
 * ⚠️ This is a record, not a claim. Rows belong to the account that wrote
 * them; naming a buddy in `participantIds` does not create an obligation on
 * that buddy's account, notify them, or appear in their ledger. See
 * expenses.service.ts.
 */
@Entity({ name: 'trip_expenses' })
@Index(['userId', 'dayIndex'])
export class ExpenseOrmEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Whose ledger this row is in. Never taken from the request body. */
  @Column({ type: 'uuid' })
  userId: string;

  /** Which day of the plan it belongs to, 0-based. */
  @Column({ type: 'int' })
  dayIndex: number;

  @Column({ type: 'varchar', length: 16 })
  category: ExpenseCategory;

  /** The stop it happened at, when it was one. Free-form spending has none. */
  @Column({ type: 'varchar', length: 128, nullable: true })
  placeId: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  placeName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  /** The whole ledger's unit: integer kuruş, never a lira float. */
  @Column({ type: 'bigint' })
  amountKurus: string;

  /** What was typed, in the currency it was typed in. */
  @Column({ type: 'numeric', precision: 12, scale: 2 })
  enteredAmount: string;

  @Column({ type: 'varchar', length: 3 })
  enteredCurrency: string;

  /** 1 unit of `enteredCurrency` was this many lira when the row was written. */
  @Column({ type: 'numeric', precision: 14, scale: 6 })
  rateToTry: string;

  /** Where that rate came from — live, cached, or the static fallback table. */
  @Column({ type: 'varchar', length: 16 })
  rateSource: string;

  /** Who actually paid. The owner, or one of their accepted connections. */
  @Column({ type: 'uuid' })
  paidByUserId: string;

  /**
   * Who it is split between. Empty means personal: it counts against the
   * budget and nobody owes anything for it.
   */
  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  participantIds: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
