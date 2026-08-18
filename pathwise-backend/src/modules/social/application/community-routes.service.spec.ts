import { CommunityRoutesService } from './community-routes.service';
import { RouteLikeRepositoryPort } from '../domain/route-like.repository.port';

/** In-memory likes, honouring the UNIQUE(userId, routeId) rule the table has. */
function repo() {
  const rows = new Set<string>();
  const port: RouteLikeRepositoryPort = {
    async like(userId, routeId) {
      rows.add(`${userId}|${routeId}`);
    },
    async unlike(userId, routeId) {
      rows.delete(`${userId}|${routeId}`);
    },
    async countsByRoute() {
      const counts = new Map<string, number>();
      for (const row of rows) {
        const routeId = row.split('|')[1];
        counts.set(routeId, (counts.get(routeId) ?? 0) + 1);
      }
      return counts;
    },
    async likedRouteIds(userId) {
      return new Set(
        [...rows].filter((r) => r.startsWith(`${userId}|`)).map((r) => r.split('|')[1]),
      );
    },
  };
  return port;
}

/**
 * Every community route is a fixture: the author names have no accounts and
 * the baseline like count is invented. The label says so, and — importantly —
 * it survives a real like, because a real interaction with demo content does
 * not make the content real.
 */
describe('CommunityRoutesService — sample labelling', () => {
  it('marks every route as sample', async () => {
    const routes = await new CommunityRoutesService(repo()).list('u-1');

    expect(routes.length).toBeGreaterThan(0);
    expect(routes.every((r) => r.isSample === true)).toBe(true);
  });

  it('keeps the label after a real user likes one', async () => {
    const service = new CommunityRoutesService(repo());
    const [first] = await service.list('u-1');

    const liked = await service.like('u-1', first.id);

    expect(liked.liked).toBe(true);
    expect(liked.likes).toBe(first.likes + 1);
    expect(liked.isSample).toBe(true);
  });
});
