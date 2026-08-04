import { PointsService } from './points.service';
import {
  isSameUtcDay,
  PointAction,
  POINT_VALUES,
  PointTransaction,
} from '../domain/points';
import { PointTransactionRepositoryPort } from '../domain/point-transaction.repository.port';
import { UsersService } from '../../users/application/users.service';

/** In-memory ledger + user balance — no DB, no Nest container. */
function makeService(seed: PointTransaction[] = [], startingPoints = 0) {
  const rows = [...seed];
  let balance = startingPoints;

  const ledger: PointTransactionRepositoryPort = {
    async record(data) {
      const row: PointTransaction = {
        id: `p${rows.length + 1}`,
        createdAt: new Date(),
        ...data,
      };
      rows.push(row);
      return row;
    },
    async findLastByAction(userId, action) {
      const matches = rows
        .filter((r) => r.userId === userId && r.action === action)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return matches[0] ?? null;
    },
    async listRecent(userId, limit) {
      return rows
        .filter((r) => r.userId === userId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit);
    },
  };

  const users = {
    async addPoints(_id: string, delta: number) {
      balance += delta;
      return { points: balance };
    },
    async findById(_id: string) {
      return { points: balance };
    },
  } as unknown as UsersService;

  return {
    service: new PointsService(ledger, users),
    rows,
    balance: () => balance,
  };
}

const txn = (action: PointAction, createdAt: Date): PointTransaction => ({
  id: 'seed',
  userId: 'u1',
  action,
  points: POINT_VALUES[action],
  reference: null,
  createdAt,
});

describe('isSameUtcDay', () => {
  it('is true for two instants inside the same UTC date', () => {
    expect(
      isSameUtcDay(
        new Date('2026-08-04T00:05:00Z'),
        new Date('2026-08-04T23:55:00Z'),
      ),
    ).toBe(true);
  });

  it('is false across the UTC midnight boundary', () => {
    expect(
      isSameUtcDay(
        new Date('2026-08-04T23:59:59Z'),
        new Date('2026-08-05T00:00:01Z'),
      ),
    ).toBe(false);
  });

  it('does not confuse the same day-of-month in different months', () => {
    expect(
      isSameUtcDay(new Date('2026-07-04T10:00:00Z'), new Date('2026-08-04T10:00:00Z')),
    ).toBe(false);
  });
});

describe('PointsService', () => {
  it('awards the configured value and adds it to the balance', async () => {
    const { service, balance } = makeService();
    const result = await service.award('u1', 'tour_reserved', 'tour-7');

    expect(result.awarded).toBe(POINT_VALUES.tour_reserved);
    expect(result.totalPoints).toBe(POINT_VALUES.tour_reserved);
    expect(balance()).toBe(POINT_VALUES.tour_reserved);
  });

  it('writes one ledger row per award, carrying the reference', async () => {
    const { service, rows } = makeService();
    await service.award('u1', 'review', 'hagiasophia');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: 'u1',
      action: 'review',
      points: POINT_VALUES.review,
      reference: 'hagiasophia',
    });
  });

  it('accumulates across different actions', async () => {
    const { service } = makeService();
    await service.award('u1', 'review');
    const second = await service.award('u1', 'referral');

    expect(second.totalPoints).toBe(POINT_VALUES.review + POINT_VALUES.referral);
  });

  // ── Daily throttle on route completion ──────────────────────────────
  it('awards a route completion when there is no history', async () => {
    const { service } = makeService();
    const result = await service.awardRouteCompletion('u1');

    expect(result.awarded).toBe(POINT_VALUES.route_completed);
  });

  it('declines a second route completion on the same day, without erroring', async () => {
    const { service, rows } = makeService();
    await service.awardRouteCompletion('u1');
    const second = await service.awardRouteCompletion('u1');

    // Declined awards report 0 and still return the balance, so the client can
    // simply skip the toast rather than handle a failure.
    expect(second.awarded).toBe(0);
    expect(second.totalPoints).toBe(POINT_VALUES.route_completed);
    // …and no ledger row is written for the declined attempt.
    expect(rows).toHaveLength(1);
  });

  it('awards again once the previous completion was on an earlier day', async () => {
    const yesterday = new Date(Date.now() - 26 * 3600 * 1000);
    const { service } = makeService([txn('route_completed', yesterday)], 30);
    const result = await service.awardRouteCompletion('u1');

    expect(result.awarded).toBe(POINT_VALUES.route_completed);
    expect(result.totalPoints).toBe(60);
  });

  it('does not let another action today block a route completion', async () => {
    // The throttle must key on `route_completed` alone — a tour booked an hour
    // ago is unrelated and must not suppress the completion reward.
    const { service } = makeService([txn('tour_reserved', new Date())], 25);
    const result = await service.awardRouteCompletion('u1');

    expect(result.awarded).toBe(POINT_VALUES.route_completed);
  });

  it('throttles per user, not globally', async () => {
    const { service } = makeService([txn('route_completed', new Date())]);
    const other = await service.awardRouteCompletion('u2');

    expect(other.awarded).toBe(POINT_VALUES.route_completed);
  });

  // ── Summary ─────────────────────────────────────────────────────────
  it('summarises the balance, the price list and recent awards', async () => {
    const { service } = makeService();
    await service.award('u1', 'review', 'galatatower');
    const summary = await service.getSummary('u1');

    expect(summary.points).toBe(POINT_VALUES.review);
    expect(summary.values).toEqual(POINT_VALUES);
    expect(summary.recent).toHaveLength(1);
    expect(summary.recent[0].action).toBe('review');
  });
});
