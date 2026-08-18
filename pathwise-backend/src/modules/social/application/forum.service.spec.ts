import { NotFoundException } from '@nestjs/common';
import { ForumService } from './forum.service';
import {
  CreateForumAnswerData,
  ForumAnswerRepositoryPort,
  PersistedForumAnswer,
} from '../domain/forum-answer.repository.port';

/**
 * In-memory stand-in for the answers table, keeping the one behaviour the
 * service depends on: what is written comes back out of `listAll`.
 */
function repo(seed: PersistedForumAnswer[] = []) {
  const rows = [...seed];
  const port: ForumAnswerRepositoryPort = {
    async create(data: CreateForumAnswerData) {
      const row = { ...data, id: `a-${rows.length + 1}`, createdAt: new Date() };
      rows.push(row);
      return row;
    },
    async listAll() {
      return rows;
    },
  };
  return port;
}

/**
 * The seed label.
 *
 * The forum is the awkward case for it: questions are all fixtures, but a
 * thread accumulates real answers underneath one, so the flag has to be per
 * answer. These tests pin both halves — that a fixture is marked, and that a
 * user's own words never are — because getting the second one wrong would
 * brand a real person's answer as demo data.
 */
describe('ForumService — sample labelling', () => {
  it('marks every seed question and seed answer', async () => {
    const threads = await new ForumService(repo()).list();

    expect(threads.length).toBeGreaterThan(0);
    expect(threads.every((q) => q.isSample === true)).toBe(true);
    expect(threads.flatMap((q) => q.answers).every((a) => a.isSample === true)).toBe(true);
  });

  it('does not mark an answer a real account wrote', async () => {
    const service = new ForumService(repo());
    const [first] = await service.list();

    const thread = await service.answer(first.id, 'u-1', 'Real Person', 'My own answer');
    const mine = thread.answers.filter((a) => a.authorName === 'Real Person');

    expect(mine).toHaveLength(1);
    expect(mine[0].isSample).toBe(false);
    // The thread it landed in is still a fixture question: the two labels are
    // independent, which is the whole reason the flag is not thread-level.
    expect(thread.isSample).toBe(true);
  });

  it('keeps both kinds in the same thread, each labelled for what it is', async () => {
    const service = new ForumService(repo());
    const [first] = await service.list();
    await service.answer(first.id, 'u-1', 'Real Person', 'Mine');

    const thread = (await service.list()).find((q) => q.id === first.id)!;

    expect(thread.answers.some((a) => a.isSample === true)).toBe(true);
    expect(thread.answers.some((a) => a.isSample === false)).toBe(true);
  });

  it('refuses an answer on a thread that does not exist', async () => {
    await expect(
      new ForumService(repo()).answer('no-such-q', 'u-1', 'Real Person', 'Hi'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
