import { NotFoundException } from '@nestjs/common';
import { SavedPlacesService } from './saved-places.service';
import { PlacesService } from '../../places/application/places.service';
import { InMemoryPlaceRepository } from '../../places/infrastructure/persistence/in-memory-place.repository';
import { PLACE_DATASET } from '../../places/infrastructure/persistence/place.dataset';
import { SavedPlaceRepositoryPort } from '../domain/saved-place.repository.port';

/**
 * The fake behaves like the table it stands in for: (userId, placeId) pairs
 * with a uniqueness guarantee and a newest-first read. That is enough to pin
 * the rules; `route-editing.spec.ts` proves the rows actually survive a reload.
 */
function fakeRepo(): SavedPlaceRepositoryPort & { rows: string[] } {
  const rows: string[] = [];
  const key = (u: string, p: string) => `${u}::${p}`;
  return {
    rows,
    save: async (u, p) => {
      if (!rows.includes(key(u, p))) rows.push(key(u, p));
    },
    unsave: async (u, p) => {
      const i = rows.indexOf(key(u, p));
      if (i >= 0) rows.splice(i, 1);
    },
    savedPlaceIds: async (u) =>
      rows
        .filter((r) => r.startsWith(`${u}::`))
        .map((r) => r.split('::')[1])
        .reverse(), // newest first, as the real ORDER BY createdAt DESC does
  };
}

describe('SavedPlacesService', () => {
  const places = new PlacesService(new InMemoryPlaceRepository());
  const [first, second] = PLACE_DATASET;

  let repo: ReturnType<typeof fakeRepo>;
  let service: SavedPlacesService;

  beforeEach(() => {
    repo = fakeRepo();
    service = new SavedPlacesService(repo, places);
  });

  it('saving twice leaves one row', async () => {
    await service.save('u1', first.placeId);
    await service.save('u1', first.placeId);
    expect(repo.rows).toHaveLength(1);
  });

  it('one person’s list is not another’s', async () => {
    await service.save('u1', first.placeId);
    await service.save('u2', second.placeId);
    expect(await service.savedIds('u1')).toEqual([first.placeId]);
    expect(await service.savedIds('u2')).toEqual([second.placeId]);
  });

  it('unsaving something never saved is not an error', async () => {
    await expect(service.unsave('u1', first.placeId)).resolves.toBeUndefined();
  });

  /**
   * There is no foreign key on `placeId` — places are a compiled-in dataset,
   * not a table — so the row would insert perfectly happily and then be
   * invisible on every read, because reads hydrate through the catalogue. A
   * save button that appears to work and produces nothing is worse than a 404.
   */
  it('refuses a placeId that is not in the catalogue', async () => {
    await expect(service.save('u1', 'not-a-real-place')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(repo.rows).toHaveLength(0);
  });

  it('returns full records in the order they were saved, newest first', async () => {
    await service.save('u1', first.placeId);
    await service.save('u1', second.placeId);
    const list = await service.list('u1');
    expect(list.map((p) => p.placeId)).toEqual([second.placeId, first.placeId]);
    expect(list[0].name).toBe(second.name);
  });

  /**
   * A place can leave the catalogue between two releases while the row that
   * points at it stays. Returning a hole would push that decision onto every
   * caller; the list simply no longer contains it, and unsave still works.
   */
  it('drops ids the catalogue no longer knows about', async () => {
    repo.rows.push('u1::retired-place-id');
    await service.save('u1', first.placeId);
    const list = await service.list('u1');
    expect(list.map((p) => p.placeId)).toEqual([first.placeId]);
  });
});
