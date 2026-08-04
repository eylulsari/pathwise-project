import { PointAction, PointTransaction } from './points';

/** DI token for the repository port (interfaces vanish at runtime). */
export const POINT_TRANSACTION_REPOSITORY = Symbol(
  'POINT_TRANSACTION_REPOSITORY',
);

export interface RecordPointTransactionData {
  userId: string;
  action: PointAction;
  points: number;
  reference: string | null;
}

/**
 * Repository Pattern — the port. `TypeOrmPointTransactionRepository` in
 * infrastructure/ implements it; the application layer only knows this.
 */
export interface PointTransactionRepositoryPort {
  record(data: RecordPointTransactionData): Promise<PointTransaction>;
  /** Most recent award of one action — backs the daily throttle. */
  findLastByAction(
    userId: string,
    action: PointAction,
  ): Promise<PointTransaction | null>;
  /** Newest first — the "how you earned it" list on the profile. */
  listRecent(userId: string, limit: number): Promise<PointTransaction[]>;
}
