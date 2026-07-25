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

// ── Selective per-day download (A5) ────────────────────────────────
const DOWNLOADED_KEY = 'pathwise.offlineDays'; // set of downloaded day indices

/** Estimate the offline footprint of a day in MB (itinerary JSON + map tiles). */
export function estimateDaySizeMb(itinerary: Itinerary | null): number {
  if (!itinerary) return 0;
  const jsonBytes = JSON.stringify(itinerary).length;
  const realStops = itinerary.stops.filter((s) => s.place).length;
  // ~1.5 MB of map tiles cached per stop's neighborhood (mock).
  const tileBytes = realStops * 1.5 * 1024 * 1024;
  return Math.max(0.1, Math.round(((jsonBytes + tileBytes) / (1024 * 1024)) * 10) / 10);
}

/** Explicitly download a chosen day for offline use. */
export async function downloadDay(index: number, itinerary: Itinerary): Promise<void> {
  await idbSet(`day-${index}-download`, itinerary);
  const set = getDownloadedDays();
  set.add(index);
  localStorage.setItem(DOWNLOADED_KEY, JSON.stringify([...set]));
}

export function getDownloadedDays(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(DOWNLOADED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export async function removeDownload(index: number): Promise<void> {
  const set = getDownloadedDays();
  set.delete(index);
  localStorage.setItem(DOWNLOADED_KEY, JSON.stringify([...set]));
}
