/** DI token for the repository port (interfaces vanish at runtime). */
export const FORUM_ANSWER_REPOSITORY = Symbol('FORUM_ANSWER_REPOSITORY');

export interface CreateForumAnswerData {
  questionId: string;
  userId: string;
  /**
   * Denormalised at write time, like check-ins: a thread is a historical
   * record and should keep saying who answered after a rename or a deletion.
   */
  authorName: string;
  text: string;
}

export interface PersistedForumAnswer extends CreateForumAnswerData {
  id: string;
  createdAt: Date;
}

export interface ForumAnswerRepositoryPort {
  create(data: CreateForumAnswerData): Promise<PersistedForumAnswer>;
  /** Every persisted answer, for grouping into threads by `questionId`. */
  listAll(): Promise<PersistedForumAnswer[]>;
}
