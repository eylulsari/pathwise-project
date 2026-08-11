/**
 * Local Q&A forum — domain model, framework-free.
 *
 * Questions are a curated seed; **answers** are the part users write, and the
 * part that is persisted. There is no "ask a question" UI, so adding one would
 * be a new feature rather than making an existing one durable.
 *
 * A thread is therefore always a seed question plus the union of its seed
 * answers and every persisted answer that names it. Same shape as the check-in
 * feed: merge, never replace, so a fresh account does not open onto an empty
 * forum.
 */
export interface ForumAnswer {
  authorName: string;
  text: string;
  createdAt: Date;
}

export interface ForumQuestion {
  id: string;
  authorName: string;
  question: string;
  createdAt: Date;
  /** Oldest first — a thread reads top to bottom. */
  answers: ForumAnswer[];
}

/** Oldest first: answers are a conversation, not a feed. */
export function byOldestFirst(a: ForumAnswer, b: ForumAnswer): number {
  return a.createdAt.getTime() - b.createdAt.getTime();
}
