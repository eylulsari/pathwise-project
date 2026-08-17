import { Inject, Injectable } from '@nestjs/common';
import { avatarColorFor, byNewestFirst, CheckIn } from '../domain/check-in';
import {
  CHECK_IN_REPOSITORY,
  CheckInRepositoryPort,
} from '../domain/check-in.repository.port';
import { seedCheckIns } from '../infrastructure/persistence/check-in.dataset';

/** How many persisted rows the feed pulls. The seed is always shown in full. */
const PERSISTED_LIMIT = 50;

/**
 * The check-in feed: curated demo entries plus everything real users have
 * posted, merged and sorted newest-first.
 *
 * Merging rather than replacing is what keeps the feature demonstrable. The
 * seed authors have no user accounts, so a persisted-only feed would be empty
 * for a fresh account — and the presence feature would have nothing to show a
 * live/stale distinction with.
 *
 * Ordering is by `createdAt` alone, which is why a just-posted check-in lands
 * at the top: it is genuinely the newest, not special-cased.
 */
@Injectable()
export class CheckInsService {
  constructor(
    @Inject(CHECK_IN_REPOSITORY)
    private readonly checkIns: CheckInRepositoryPort,
  ) {}

  async list(): Promise<CheckIn[]> {
    // One clock reading for the whole feed, so the seed's relative offsets and
    // the persisted rows are compared against the same instant.
    const now = Date.now();
    const persisted = await this.checkIns.listRecent(PERSISTED_LIMIT);

    const real: CheckIn[] = persisted.map((row) => ({
      id: row.id,
      traveler: {
        id: row.userId,
        name: row.authorName,
        avatarColor: avatarColorFor(row.userId),
        // A real account: `userId` is a real users-table id, so this author can
        // be asked to connect.
        isSample: false,
      },
      placeId: row.placeId,
      hub: row.hub,
      message: row.message,
      createdAt: row.createdAt,
    }));

    return [...real, ...seedCheckIns(now)].sort(byNewestFirst);
  }

  /**
   * Post a check-in.
   *
   * The author is the authenticated caller — the controller reads it from the
   * JWT and passes it in. Nothing about the author comes from the request
   * body, so a client cannot post as somebody else.
   */
  async create(userId: string, authorName: string, message: string): Promise<CheckIn> {
    const row = await this.checkIns.create({
      userId,
      authorName,
      message,
      // The composer collects a message and nothing else, so there is no place
      // and no neighbourhood to record. Storing a guessed one would put a pin
      // on the map where nobody actually was.
      placeId: null,
      hub: null,
    });

    return {
      id: row.id,
      traveler: {
        id: row.userId,
        name: row.authorName,
        avatarColor: avatarColorFor(row.userId),
        // A real account: `userId` is a real users-table id, so this author can
        // be asked to connect.
        isSample: false,
      },
      placeId: row.placeId,
      hub: row.hub,
      message: row.message,
      createdAt: row.createdAt,
    };
  }
}
