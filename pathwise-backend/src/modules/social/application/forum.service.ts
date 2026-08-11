import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { byOldestFirst, ForumQuestion } from '../domain/forum';
import {
  FORUM_ANSWER_REPOSITORY,
  ForumAnswerRepositoryPort,
} from '../domain/forum-answer.repository.port';
import { seedForum } from '../infrastructure/persistence/forum.dataset';

/**
 * The Q&A forum: curated seed threads whose answers are the union of the seed
 * ones and everything users have written.
 *
 * Questions are seed-only by design — there is no UI to ask one, so persisting
 * them would be adding a feature rather than making an existing one durable.
 */
@Injectable()
export class ForumService {
  constructor(
    @Inject(FORUM_ANSWER_REPOSITORY)
    private readonly answers: ForumAnswerRepositoryPort,
  ) {}

  async list(): Promise<ForumQuestion[]> {
    // One clock reading for the whole forum, so seed offsets and persisted
    // timestamps are measured against the same instant.
    const now = Date.now();
    const persisted = await this.answers.listAll();

    const byQuestion = new Map<string, typeof persisted>();
    for (const row of persisted) {
      const list = byQuestion.get(row.questionId) ?? [];
      list.push(row);
      byQuestion.set(row.questionId, list);
    }

    return seedForum(now).map((question) => ({
      ...question,
      answers: [
        ...question.answers,
        ...(byQuestion.get(question.id) ?? []).map((row) => ({
          authorName: row.authorName,
          text: row.text,
          createdAt: row.createdAt,
        })),
      ].sort(byOldestFirst),
    }));
  }

  /**
   * Answer a thread. The author is the authenticated caller, passed in by the
   * controller from the verified JWT — never from the request body.
   *
   * The question id is validated against the seed so an answer cannot be
   * attached to a thread that does not exist (which would persist a row
   * nothing will ever read).
   */
  async answer(
    questionId: string,
    userId: string,
    authorName: string,
    text: string,
  ): Promise<ForumQuestion> {
    const exists = seedForum().some((q) => q.id === questionId);
    if (!exists) throw new NotFoundException('Question not found');

    await this.answers.create({ questionId, userId, authorName, text });

    const threads = await this.list();
    // `find` cannot miss: existence was just checked against the same seed.
    return threads.find((q) => q.id === questionId) as ForumQuestion;
  }
}
