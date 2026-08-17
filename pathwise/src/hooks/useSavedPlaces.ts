import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * The signed-in traveller's bookmarked places.
 *
 * The set of ids is fetched once and then kept in step optimistically: the
 * toggle flips locally before the request lands, because a bookmark button
 * that waits for a round trip feels broken on a phone. A failed request rolls
 * the flip back rather than leaving the heart lying about what the server has.
 */
export function useSavedPlaces() {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .getSavedPlaceIds()
      .then((list) => {
        if (!cancelled) setIds(new Set(list));
      })
      .catch(() => {
        /* signed out or offline — an empty set is the honest default */
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (placeId: string) => {
    let wasSaved = false;
    setIds((prev) => {
      wasSaved = prev.has(placeId);
      const next = new Set(prev);
      if (wasSaved) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
    try {
      if (wasSaved) await api.unsavePlace(placeId);
      else await api.savePlace(placeId);
    } catch {
      setIds((prev) => {
        const next = new Set(prev);
        if (wasSaved) next.add(placeId);
        else next.delete(placeId);
        return next;
      });
    }
  }, []);

  return { savedIds: ids, loaded, toggle, isSaved: (id: string) => ids.has(id) };
}
