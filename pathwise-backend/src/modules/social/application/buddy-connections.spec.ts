import { NotFoundException } from '@nestjs/common';
import { SocialService } from './social.service';
import { BuddyConnectionRepositoryPort } from '../domain/buddy-connection.repository.port';
import { TRAVELER_SEED } from '../infrastructure/persistence/traveler.dataset';

/**
 * Buddy connections were the last user-generated state living in
 * `localStorage`, which meant a connection existed in one browser and nowhere
 * else: it did not survive a different device, and the SOS "share my location"
 * alert targeted a list the server had never seen.
 *
 * The fake below behaves like the table it stands in for — a set of
 * (userId, travelerId) pairs with a uniqueness guarantee — so these tests can
 * assert the rules without a database. The rules are what matter here;
 * `social-persistence.spec.ts` proves the rows actually survive a reload.
 */
function fakeRepo(): BuddyConnectionRepositoryPort & { rows: Set<string> } {
  const rows = new Set<string>();
  const key = (u: string, t: string) => `${u}::${t}`;
  return {
    rows,
    connect: async (u, t) => void rows.add(key(u, t)),
    disconnect: async (u, t) => void rows.delete(key(u, t)),
    connectedTravelerIds: async (u) =>
      new Set(
        [...rows].filter((r) => r.startsWith(`${u}::`)).map((r) => r.split('::')[1]),
      ),
  };
}

const optedIn = { womenModeActive: true };
const browsing = { womenModeActive: false };
const openToAll = TRAVELER_SEED.find((t) => !t.visibleToWomenOnly)!;
const hidden = TRAVELER_SEED.find((t) => t.visibleToWomenOnly)!;

describe('buddy connections', () => {
  it('a connection is readable back on a fresh list call', async () => {
    const repo = fakeRepo();
    const service = new SocialService(repo);

    await service.connect('user-1', openToAll.id, browsing);

    // A separate read — nothing carried over in memory from the write.
    const result = await service.listTravelers({}, browsing, 'user-1');
    expect(result.connectedTravelerIds).toContain(openToAll.id);
  });

  it('connecting twice leaves one connection, not two', async () => {
    const repo = fakeRepo();
    const service = new SocialService(repo);

    await service.connect('user-1', openToAll.id, browsing);
    await service.connect('user-1', openToAll.id, browsing);

    const result = await service.listTravelers({}, browsing, 'user-1');
    expect(
      result.connectedTravelerIds.filter((id) => id === openToAll.id),
    ).toHaveLength(1);
  });

  it('disconnecting takes it back, and is safe to repeat', async () => {
    const repo = fakeRepo();
    const service = new SocialService(repo);

    await service.connect('user-1', openToAll.id, browsing);
    await service.disconnect('user-1', openToAll.id);
    await service.disconnect('user-1', openToAll.id); // no-op, must not throw

    const result = await service.listTravelers({}, browsing, 'user-1');
    expect(result.connectedTravelerIds).not.toContain(openToAll.id);
  });

  it('keeps one person’s connections out of another’s list', async () => {
    const repo = fakeRepo();
    const service = new SocialService(repo);

    await service.connect('user-1', openToAll.id, browsing);

    const other = await service.listTravelers({}, browsing, 'user-2');
    expect(other.connectedTravelerIds).toEqual([]);
  });

  it('reports nothing connected for an anonymous read', async () => {
    const repo = fakeRepo();
    const service = new SocialService(repo);
    await service.connect('user-1', openToAll.id, browsing);

    const anon = await service.listTravelers({}, browsing);
    expect(anon.connectedTravelerIds).toEqual([]);
  });

  // ── the reciprocity rule, applied to writes ────────────────────────

  it('refuses a connection to a traveler the viewer cannot see', async () => {
    const service = new SocialService(fakeRepo());
    // Same 404 an unknown id gets: a different error would confirm that this
    // traveler exists, which is the declaration the rule hides.
    await expect(service.connect('user-1', hidden.id, browsing)).rejects.toThrow(
      NotFoundException,
    );
    await expect(service.connect('user-1', 'no-such-id', optedIn)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('allows the same connection once the viewer has opted in', async () => {
    const service = new SocialService(fakeRepo());
    await expect(
      service.connect('user-1', hidden.id, optedIn),
    ).resolves.toBeUndefined();
  });

  it('never names a connection the viewer can no longer see', async () => {
    // Connected while opted in, then read while browsing: the id must drop out
    // of the response, or the visibility rule would be undone by the
    // connection list.
    const repo = fakeRepo();
    const service = new SocialService(repo);
    await service.connect('user-1', hidden.id, optedIn);

    const asOptedIn = await service.listTravelers({}, optedIn, 'user-1');
    expect(asOptedIn.connectedTravelerIds).toContain(hidden.id);

    const asBrowsing = await service.listTravelers({}, browsing, 'user-1');
    expect(asBrowsing.connectedTravelerIds).not.toContain(hidden.id);
  });

  it('lets someone disconnect from a traveler who has since become hidden', async () => {
    // Not visibility-checked on purpose: otherwise the connection would be
    // impossible to undo once the other person changed their setting.
    const repo = fakeRepo();
    const service = new SocialService(repo);
    await service.connect('user-1', hidden.id, optedIn);

    await expect(service.disconnect('user-1', hidden.id)).resolves.toBeUndefined();
    const result = await service.listTravelers({}, optedIn, 'user-1');
    expect(result.connectedTravelerIds).not.toContain(hidden.id);
  });
});
