import { useCallback, useEffect, useRef, useState } from 'react';

/** What a list knows about itself. `ready` is the only state holding data. */
export type LoadStatus = 'loading' | 'ready' | 'error';

/**
 * Fetch a list and keep the three states apart.
 *
 * "Loading", "failed" and "empty" are three different answers, and collapsing
 * them into an empty array turns two of them into a confident false statement:
 * a request that never arrived gets rendered as "nobody has checked in yet" or
 * "you have not saved anywhere", which reads as a fact about the world rather
 * than a fact about the network. The saved-places list had exactly that bug,
 * and the poll list had half of it — it told the truth about failures but
 * still said "no polls yet" during the window before the first response.
 *
 * Putting it in a hook rather than repeating the triple in every component is
 * the point: the distinction stops depending on whoever writes the next list
 * remembering to make it.
 *
 * The sequence guard means a slow earlier response cannot overwrite a newer
 * one — `reload` is called after writes, so two loads really are in flight at
 * once, and the older one answering last would put back the list from before
 * the write.
 */
export function useAsyncList<T>(
  fetcher: () => Promise<T[]>,
  deps: unknown[] = [],
): {
  items: T[];
  status: LoadStatus;
  reload: () => Promise<void>;
  /** For writes that already know the new list — skips a round trip. */
  setItems: (next: T[] | ((prev: T[]) => T[])) => void;
} {
  const [items, setItems] = useState<T[]>([]);
  const [status, setStatus] = useState<LoadStatus>('loading');

  // Kept in a ref so `reload` is stable regardless of how the caller declares
  // its fetcher — an inline arrow would otherwise change identity every render
  // and restart the effect forever.
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const seq = useRef(0);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    const ticket = ++seq.current;
    try {
      const next = await fetcherRef.current();
      if (!alive.current || seq.current !== ticket) return;
      setItems(next);
      setStatus('ready');
    } catch {
      if (!alive.current || seq.current !== ticket) return;
      // Deliberately leaves `items` alone: on a reload after a write, the list
      // already on screen is better than blanking it because a refresh failed.
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void reload();
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { items, status, reload, setItems };
}
