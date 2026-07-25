import { JournalEntry } from './journal-entry';

export const JOURNAL_REPOSITORY = Symbol('JOURNAL_REPOSITORY');

export interface UpsertJournalData {
  userId: string;
  placeId: string;
  photoUrl?: string | null;
  note?: string | null;
  rating: number;
}

/** Repository Pattern port for Trip Journal entries. */
export interface JournalRepositoryPort {
  /** One entry per (user, place) — inserts or updates. */
  upsert(data: UpsertJournalData): Promise<JournalEntry>;
  findByUser(userId: string): Promise<JournalEntry[]>;
}
