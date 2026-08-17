import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { NotificationsService } from '../../notifications/application/notifications.service';
import {
  PollOption,
  PollOrmEntity,
  PollVoteOrmEntity,
} from '../infrastructure/persistence/poll.orm-entities';

interface CreatePollInput {
  question: string;
  options: { placeId: string; label: string }[];
}

/**
 * Group polls (B3). Connected friends vote; the winner can be auto-added to
 * Today's Path. Creating a poll pushes a notification via the Notification
 * Center (B6). (Friend graph is client-side, so voting is open for the demo.)
 */
@Injectable()
export class PollsService {
  constructor(
    @InjectRepository(PollOrmEntity)
    private readonly polls: Repository<PollOrmEntity>,
    private readonly notifications: NotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  async create(creatorUserId: string, input: CreatePollInput) {
    if (input.options.length < 2) {
      throw new BadRequestException('A poll needs at least two options');
    }
    const options: PollOption[] = input.options.map((o) => ({
      id: uuid().slice(0, 8),
      placeId: o.placeId,
      label: o.label,
      votes: 0,
    }));
    const poll = await this.polls.save(
      this.polls.create({ creatorUserId, question: input.question, options, status: 'open', winnerPlaceId: null }),
    );
    // B3 → B6 trigger. (Real system: notify each connected friend.)
    await this.notifications.notify(
      creatorUserId,
      'poll',
      '🗳️ Poll started',
      `Your poll "${input.question}" is live — friends can vote now.`,
    );
    return poll;
  }

  /**
   * Read the poll for writing, inside a transaction, holding the row until the
   * caller commits.
   *
   * Voting and closing both rewrite the whole row, and a user produces both
   * within a second of each other by voting and then closing. Read plainly,
   * the two overlap: each loads the poll, changes its own field and saves
   * everything back, so whichever saves second silently reverts the other. In
   * a 20-round probe against the dev server, 13 polls came back *open* after a
   * close that had returned 200 — the vote had written the stale `status` back
   * over it. The client believed the poll was closed and the database did not.
   *
   * `pessimistic_write` is `SELECT … FOR UPDATE`: the second request now waits
   * for the first to commit and then reads what it actually wrote, so the vote
   * sees `closed` and refuses instead of overwriting it.
   */
  private lockPoll(manager: EntityManager, pollId: string) {
    return manager.findOne(PollOrmEntity, {
      where: { id: pollId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async vote(userId: string, pollId: string, optionId: string) {
    return this.dataSource.transaction(async (manager) => {
      const poll = await this.lockPoll(manager, pollId);
      if (!poll) throw new NotFoundException('Poll not found');
      if (poll.status !== 'open') throw new BadRequestException('Poll is closed');
      const option = poll.options.find((o) => o.id === optionId);
      if (!option) throw new BadRequestException('Invalid option');

      const already = await manager.findOne(PollVoteOrmEntity, {
        where: { pollId, userId },
      });
      if (already) throw new BadRequestException('You have already voted');

      await manager.save(
        manager.create(PollVoteOrmEntity, { pollId, userId, optionId }),
      );
      option.votes += 1;
      poll.options = [...poll.options]; // ensure jsonb change is detected
      return manager.save(poll);
    });
  }

  async close(userId: string, pollId: string) {
    return this.dataSource.transaction(async (manager) => {
      const poll = await this.lockPoll(manager, pollId);
      if (!poll) throw new NotFoundException('Poll not found');
      if (poll.creatorUserId !== userId) {
        throw new BadRequestException('Only the creator can close the poll');
      }
      const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];
      poll.status = 'closed';
      poll.winnerPlaceId = winner?.placeId ?? null;
      return manager.save(poll);
    });
  }

  async listActive() {
    return this.polls.find({ order: { createdAt: 'DESC' }, take: 20 });
  }
}
