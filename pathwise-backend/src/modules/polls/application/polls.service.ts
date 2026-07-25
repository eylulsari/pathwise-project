import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    @InjectRepository(PollVoteOrmEntity)
    private readonly votes: Repository<PollVoteOrmEntity>,
    private readonly notifications: NotificationsService,
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

  async vote(userId: string, pollId: string, optionId: string) {
    const poll = await this.polls.findOne({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.status !== 'open') throw new BadRequestException('Poll is closed');
    const option = poll.options.find((o) => o.id === optionId);
    if (!option) throw new BadRequestException('Invalid option');

    const already = await this.votes.findOne({ where: { pollId, userId } });
    if (already) throw new BadRequestException('You have already voted');

    await this.votes.save(this.votes.create({ pollId, userId, optionId }));
    option.votes += 1;
    poll.options = [...poll.options]; // ensure jsonb change is detected
    return this.polls.save(poll);
  }

  async close(userId: string, pollId: string) {
    const poll = await this.polls.findOne({ where: { id: pollId } });
    if (!poll) throw new NotFoundException('Poll not found');
    if (poll.creatorUserId !== userId) {
      throw new BadRequestException('Only the creator can close the poll');
    }
    const winner = [...poll.options].sort((a, b) => b.votes - a.votes)[0];
    poll.status = 'closed';
    poll.winnerPlaceId = winner?.placeId ?? null;
    return this.polls.save(poll);
  }

  async listActive() {
    return this.polls.find({ order: { createdAt: 'DESC' }, take: 20 });
  }
}
