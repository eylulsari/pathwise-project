/**
 * Minimal IndexedDB key/value store for offline mode. Caches the current
 * day itineraries so the app can open and show the last plan with no network.
 * (Map tiles are cached separately by the service worker — see vite.config.)
 */
import type { Itinerary } from '../types';

const DB_NAME = 'pathwise-offline';
const STORE = 'cache';
const KEY_ITINERARIES = 'day-itineraries';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openDb();
  const value = await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as T) ?? null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}

/** Persist the per-day itineraries (called whenever a plan changes). */
export async function cacheItineraries(itineraries: (Itinerary | null)[]): Promise<void> {
  try {
    await idbSet(KEY_ITINERARIES, itineraries);
  } catch {
    /* private mode / quota — offline cache is best-effort */
  }
}

/** Load the last cached itineraries (used when opening offline). */
export async function loadCachedItineraries(): Promise<(Itinerary | null)[] | null> {
  try {
    return await idbGet<(Itinerary | null)[]>(KEY_ITINERARIES);
  } catch {
    return null;
  }
}
