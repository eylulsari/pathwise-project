import type { PersistedDay } from '../types';

/**
 * The edit that has not reached the server yet, written somewhere a reload
 * can find it.
 *
 * WHAT WAS WRONG
 * Removing a stop and reloading within the 700 ms autosave debounce lost the
 * removal about one time in eight. The `pagehide` flush was already there and
 * was not the problem — it fires, and it sends. The problem is that it sends
 * on one connection while the *next* document immediately issues `GET /plan`
 * on another, and nothing orders the two. When the read wins, hydration
 * restores the plan as it was before the edit, the traveller sees the deleted
 * stop back on the list, and the next autosave writes that stale plan back
 * over the good one. The edit is then gone for good.
 *
 * No amount of flushing fixes that, because the losing half is the read.
 *
 * WHAT THIS DOES
 * Every edit is written to `localStorage` synchronously, tagged with a
 * revision number, before the debounce is even scheduled. A revision is
 * marked acknowledged only when the server has confirmed that exact write.
 * So `pendingPlan()` answers one question — "is there an edit here that the
 * server has not confirmed?" — and hydration prefers that answer over the one
 * that came back over the network, then re-saves to make the server agree.
 *
 * localStorage, not IndexedDB: the write has to complete inside the unload
 * handler, and only localStorage is synchronous. The record holds the stop
 * ORDER without cached itineraries, the same trade the flush makes, which
 * keeps it small and reuses the rebuild path hydration already has.
 *
 * SEQUENTIAL, TOO
 * `enqueue` keeps one save in flight at a time. Two overlapping PUTs are
 * decided by whichever finishes last, which is not necessarily the newest —
 * a slow save of an old plan could otherwise land on top of a fast save of a
 * new one. Saves requested while one is running collapse into a single
 * trailing save carrying the latest plan, because the intermediate states
 * were never worth a round trip.
 */

const KEY = 'pathwise.planJournal';

interface JournalRecord {
  /** Whose plan this is. A shared browser must not hand it to the next person. */
  userId: string;
  /** Bumped on every local edit. */
  rev: number;
  /** The highest revision the server has confirmed writing. */
  ackedRev: number;
  /** Stop order only — no cached itineraries. */
  days: PersistedDay[];
}

function read(): JournalRecord | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as JournalRecord;
    if (typeof parsed?.rev !== 'number' || !Array.isArray(parsed?.days)) return null;
    return parsed;
  } catch {
    // Private mode, quota, or something else's key. A missing journal costs
    // the old behaviour, not a crash.
    return null;
  }
}

function write(record: JournalRecord): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* best-effort: quota or private mode */
  }
}

/**
 * Record an edit and return its revision.
 *
 * Call this in the effect body, not inside the debounce — the whole point is
 * that it has already happened by the time a reload can interrupt anything.
 */
export function recordEdit(userId: string, days: PersistedDay[]): number {
  const previous = read();
  // A different account's journal is not ours to build on.
  const base = previous && previous.userId === userId ? previous : null;
  const rev = (base?.rev ?? 0) + 1;
  write({ userId, rev, ackedRev: base?.ackedRev ?? 0, days });
  return rev;
}

/** Mark a revision as safely on the server. */
export function markSaved(userId: string, rev: number): void {
  const current = read();
  if (!current || current.userId !== userId) return;
  if (rev <= current.ackedRev) return;
  write({ ...current, ackedRev: rev });
}

/**
 * The plan this browser holds that the server has not confirmed, or null.
 *
 * Null is the normal answer. It is non-null only between an edit and its
 * acknowledgement — which is exactly the window a reload can land in.
 */
export function pendingPlan(userId: string): PersistedDay[] | null {
  const record = read();
  if (!record || record.userId !== userId) return null;
  if (record.rev <= record.ackedRev) return null;
  return record.days;
}

/** Forget everything. For sign-out, and for a plan deliberately cleared. */
export function clearJournal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}

// ── one save at a time ───────────────────────────────────────────────

let inFlight = false;
let trailing: (() => Promise<void>) | null = null;

function run(task: () => Promise<void>): void {
  inFlight = true;
  void task()
    .catch(() => {
      /* an autosave that fails must not interrupt planning */
    })
    .then(() => {
      inFlight = false;
      const next = trailing;
      trailing = null;
      if (next) run(next);
    });
}

/**
 * Run `task` once nothing else is saving.
 *
 * Only the most recent waiting task is kept: if three edits queue up behind
 * one slow request, the server needs the third, not all three in order.
 */
export function enqueue(task: () => Promise<void>): void {
  if (inFlight) {
    trailing = task;
    return;
  }
  run(task);
}

/** Test seam: forget any queued work. */
export function resetQueue(): void {
  inFlight = false;
  trailing = null;
}
