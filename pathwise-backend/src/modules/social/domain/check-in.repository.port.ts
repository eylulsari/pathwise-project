import { Hub } from '../../places/domain/place';

/** DI token for the repository port (interfaces vanish at runtime). */
export const CHECK_IN_REPOSITORY = Symbol('CHECK_IN_REPOSITORY');

export interface CreateCheckInData {
  userId: string;
  /**
   * Denormalised author name, captured at write time.
   *
   * The feed is a historical record: it should keep saying who posted, even if
   * that account is later renamed or removed. Joining `users` on every read
   * would also rewrite the past every time someone edits their profile.
   */
  authorName: string;
  message: string;
  placeId: string | null;
  hub: Hub | null;
}

export interface PersistedCheckIn extends CreateCheckInData {
  id: string;
  createdAt: Date;
}

/**
 * Repository Pattern — the port. `TypeOrmCheckInRepository` implements it.
 */
export interface CheckInRepositoryPort {
  create(data: CreateCheckInData): Promise<PersistedCheckIn>;
  /** Newest first. */
  listRecent(limit: number): Promise<PersistedCheckIn[]>;
}
