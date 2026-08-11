import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Hub, Interest } from '../../places/domain/place';
import {
  ROUTE_LIKE_REPOSITORY,
  RouteLikeRepositoryPort,
} from '../domain/route-like.repository.port';
import { COMMUNITY_ROUTE_SEED } from '../infrastructure/persistence/community-route.dataset';

/** A route as a viewer sees it: counts and `liked` are per-request. */
export interface CommunityRouteView {
  id: string;
  title: string;
  authorName: string;
  hub: Hub;
  stops: number;
  distanceKm: number;
  tags: Interest[];
  /** Static demo baseline + how many people actually liked it. */
  likes: number;
  /** Whether *this* viewer has liked it. */
  liked: boolean;
}

/**
 * Community routes and their likes.
 *
 * The routes are a curated seed — there is no "publish a route" UI. Liking is
 * the part users do, so that is the part with a table.
 *
 * ⚠️ The like count is DERIVED on every read: `seedLikes + COUNT(route_likes)`.
 * Nothing anywhere increments or decrements a stored total, so the number can
 * never drift away from the rows that justify it. The seed baseline is static
 * demo data and is never written to.
 */
@Injectable()
export class CommunityRoutesService {
  constructor(
    @Inject(ROUTE_LIKE_REPOSITORY)
    private readonly likes: RouteLikeRepositoryPort,
  ) {}

  async list(viewerId: string): Promise<CommunityRouteView[]> {
    const [counts, mine] = await Promise.all([
      this.likes.countsByRoute(),
      this.likes.likedRouteIds(viewerId),
    ]);

    return COMMUNITY_ROUTE_SEED.map((route) => ({
      id: route.id,
      title: route.title,
      authorName: route.authorName,
      hub: route.hub,
      stops: route.stops,
      distanceKm: route.distanceKm,
      tags: route.tags,
      likes: route.seedLikes + (counts.get(route.id) ?? 0),
      liked: mine.has(route.id),
    }));
  }

  /**
   * Like a route. Idempotent — liking twice leaves one row and one like, which
   * is why this is a PUT rather than a toggling POST: a client that retries,
   * or double-fires, cannot inflate the count or silently undo itself.
   */
  async like(viewerId: string, routeId: string): Promise<CommunityRouteView> {
    this.assertExists(routeId);
    await this.likes.like(viewerId, routeId);
    return this.one(viewerId, routeId);
  }

  /** Remove a like. Idempotent — unliking what was never liked is a no-op. */
  async unlike(viewerId: string, routeId: string): Promise<CommunityRouteView> {
    this.assertExists(routeId);
    await this.likes.unlike(viewerId, routeId);
    return this.one(viewerId, routeId);
  }

  private assertExists(routeId: string): void {
    if (!COMMUNITY_ROUTE_SEED.some((r) => r.id === routeId)) {
      // Otherwise a typo would persist a like on a route nobody can see.
      throw new NotFoundException('Route not found');
    }
  }

  private async one(viewerId: string, routeId: string): Promise<CommunityRouteView> {
    const all = await this.list(viewerId);
    return all.find((r) => r.id === routeId) as CommunityRouteView;
  }
}
