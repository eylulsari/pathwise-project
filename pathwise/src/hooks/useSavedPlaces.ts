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

  /**
   * Load the set, retrying a failed request rather than settling on empty.
   *
   * This used to swallow the error and leave the set empty, on the reasoning
   * that "signed out or offline" makes empty the honest default. It is not
   * honest for a signed-in traveller whose request merely failed: an empty set
   * means every ☆ reads unsaved, and it means `savedCount` is 0, which removes
   * the "start from my saved places" button from the page entirely. The
   * feature does not degrade — it disappears, permanently, because nothing
   * ever asked again.
   *
   * Three attempts with a short backoff, then give up quietly. Being signed
   * out still ends in an empty set; the difference is that a blip no longer
   * does.
   */
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const list = await api.getSavedPlaceIds();
          if (!cancelled) {
            setIds(new Set(list));
            setLoaded(true);
          }
          return;
        } catch {
          if (cancelled) return;
          await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
        }
      }
      if (!cancelled) setLoaded(true);
    };

    void load();
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
