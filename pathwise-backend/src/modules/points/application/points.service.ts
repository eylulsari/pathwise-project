import { Inject, Injectable, Logger } from '@nestjs/common';
import { UsersService } from '../../users/application/users.service';
import {
  AwardResult,
  isSameUtcDay,
  PointAction,
  POINT_VALUES,
  PointTransaction,
} from '../domain/points';
import {
  POINT_TRANSACTION_REPOSITORY,
  PointTransactionRepositoryPort,
} from '../domain/point-transaction.repository.port';

const RECENT_LIMIT = 10;

/**
 * Reward points (Phase 3) — accrual and visibility only, no spending yet.
 *
 * Every award writes a ledger row AND bumps the denormalised `users.points`
 * counter. The counter is what the UI reads (one cheap column on a row it
 * already loads); the ledger is what makes the counter explainable and, later,
 * safely spendable. See the note in `domain/points.ts`.
 */
@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @Inject(POINT_TRANSACTION_REPOSITORY)
    private readonly ledger: PointTransactionRepositoryPort,
    private readonly users: UsersService,
  ) {}

  /**
   * Award the points for an action, unconditionally.
   *
   * Callers that need a rule (a throttle, a first-time-only check) enforce it
   * themselves before calling — see `awardRouteCompletion` for the one rule
   * that lives here because it is about this module's own history.
   */
  async award(
    userId: string,
    action: PointAction,
    reference: string | null = null,
  ): Promise<AwardResult> {
    const points = POINT_VALUES[action];
    await this.ledger.record({ userId, action, points, reference });
    const user = await this.users.addPoints(userId, points);
    return { action, awarded: points, totalPoints: user.points };
  }

  /**
   * Award points for finishing a day's route, at most once per calendar day.
   *
   * Completion is detected in the browser (the dashboard ticks off stops), so
   * this endpoint is reachable whenever the client chooses to call it. The
   * daily throttle is a deliberately cheap guard: it stops the obvious replay
   * (finish → regenerate → finish again) without pretending to be airtight.
   *
   * TODO(idempotency): key the award on the itinerary's real identity
   * (`generatedAt` + hub, or a persisted itinerary id once routes are saved
   * server-side) and reject a repeat of that exact route instead of rate
   * limiting the action. That needs the itinerary to exist on the server at
   * completion time, which it currently does not.
   */
  async awardRouteCompletion(userId: string): Promise<AwardResult> {
    const last = await this.ledger.findLastByAction(userId, 'route_completed');
    if (last && isSameUtcDay(last.createdAt, new Date())) {
      this.logger.debug(
        `route_completed throttled for user ${userId} (already awarded today)`,
      );
      const user = await this.users.findById(userId);
      return { action: 'route_completed', awarded: 0, totalPoints: user.points };
    }
    return this.award(userId, 'route_completed');
  }

  /**
   * Balance + how it was earned + the price list, in one call — the profile
   * card renders all three and should not have to fan out to get them.
   */
  async getSummary(userId: string): Promise<{
    points: number;
    values: Record<PointAction, number>;
    recent: PointTransaction[];
  }> {
    const user = await this.users.findById(userId);
    const recent = await this.ledger.listRecent(userId, RECENT_LIMIT);
    return { points: user.points, values: POINT_VALUES, recent };
  }
}
