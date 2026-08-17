import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DirectMessageOrmEntity,
  UserBlockOrmEntity,
  UserConnectionOrmEntity,
} from '../infrastructure/persistence/messaging.orm-entities';
import { UsersService } from '../../users/application/users.service';

/**
 * How many messages one account may send in a day, across all conversations.
 *
 * Counted from the messages table rather than from a counter in memory. The
 * in-process store this codebase uses elsewhere resets on restart and is not
 * shared between instances — fine for protecting a shared API key, useless
 * against someone who only has to wait for a deploy. The table is the same
 * data the limit is about, so it cannot drift from it.
 */
const DAILY_MESSAGE_LIMIT = 200;
/** A fast conversation, not a script. Per minute, per account. */
const BURST_MESSAGE_LIMIT = 20;
/**
 * Connection requests per hour, per account.
 *
 * This is the number that matters for harassment: messaging is gated behind
 * consent, so the only thing a stranger can do to you unbidden is ask, and
 * asking is what has to be expensive.
 *
 * Counted per user rather than by the `@Throttle` decorator this codebase uses
 * elsewhere, because that decorator keys on IP. Everyone behind one hotel or
 * campus NAT would share a single budget and lock each other out — which the
 * e2e suite demonstrated immediately by 429ing itself from one machine.
 */
const HOURLY_CONNECTION_REQUEST_LIMIT = 20;

/**
 * Direct messaging between connected accounts.
 *
 * Two rules decide everything here, and both are checked on every read and
 * every write:
 *
 *  1. There is an accepted connection between the two accounts.
 *  2. Neither has blocked the other.
 *
 * They are enforced in this service rather than in the controller so that no
 * future endpoint can reach the tables without passing them. The identities
 * always come from the authenticated session; nothing in a request body is
 * trusted to say who the sender is.
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    @InjectRepository(UserConnectionOrmEntity)
    private readonly connections: Repository<UserConnectionOrmEntity>,
    @InjectRepository(UserBlockOrmEntity)
    private readonly blocks: Repository<UserBlockOrmEntity>,
    @InjectRepository(DirectMessageOrmEntity)
    private readonly messages: Repository<DirectMessageOrmEntity>,
    private readonly users: UsersService,
  ) {}

  // ── connections ──────────────────────────────────────────────────

  /**
   * Ask to connect.
   *
   * A crossing request — they asked you while you were asking them — is
   * accepted rather than rejected as a duplicate. Both people have now said
   * yes, which is the whole condition, and failing on a race that two willing
   * users created would be an odd way to enforce consent.
   */
  async requestConnection(requesterId: string, addresseeId: string): Promise<void> {
    if (requesterId === addresseeId) {
      throw new BadRequestException('You cannot connect with yourself');
    }
    // Throws NotFoundException itself when the id is unknown.
    await this.users.findById(addresseeId);
    // A block in either direction means this request must not exist. Checked
    // before writing, so blocking someone also stops them asking again.
    if (await this.isBlockedEitherWay(requesterId, addresseeId)) {
      throw new ForbiddenException('You cannot connect with this user');
    }

    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const askedRecently = await this.connections
      .createQueryBuilder('c')
      .where('c."requesterId" = :requesterId', { requesterId })
      .andWhere('c."createdAt" > :since', { since: hourAgo })
      .getCount();
    if (askedRecently >= HOURLY_CONNECTION_REQUEST_LIMIT) {
      throw new ForbiddenException('Too many connection requests — try again later');
    }

    const reverse = await this.connections.findOne({
      where: { requesterId: addresseeId, addresseeId: requesterId },
    });
    if (reverse) {
      if (reverse.status === 'pending') {
        reverse.status = 'accepted';
        reverse.respondedAt = new Date();
        await this.connections.save(reverse);
      }
      return; // already accepted, or now accepted — either way, done
    }

    // Idempotent: asking twice is not an error, and must not create a second
    // row that a later accept could miss.
    await this.connections
      .createQueryBuilder()
      .insert()
      .values({ requesterId, addresseeId, status: 'pending', respondedAt: null })
      .orIgnore()
      .execute();
  }

  /** Accept a request that was made to you. Only the addressee may accept. */
  async acceptConnection(userId: string, requesterId: string): Promise<void> {
    const row = await this.connections.findOne({
      where: { requesterId, addresseeId: userId },
    });
    if (!row) throw new NotFoundException('No pending request from this user');
    if (await this.isBlockedEitherWay(userId, requesterId)) {
      throw new ForbiddenException('You cannot connect with this user');
    }
    if (row.status === 'accepted') return;
    row.status = 'accepted';
    row.respondedAt = new Date();
    await this.connections.save(row);
  }

  /**
   * Are these two connected? The single question the messaging rule asks.
   *
   * Direction-agnostic on purpose: the row records who asked, which is history,
   * not permission. Once accepted, the permission belongs to the pair.
   */
  async areConnected(a: string, b: string): Promise<boolean> {
    const count = await this.connections.count({
      where: [
        { requesterId: a, addresseeId: b, status: 'accepted' },
        { requesterId: b, addresseeId: a, status: 'accepted' },
      ],
    });
    return count > 0;
  }

  async listConnections(userId: string): Promise<
    { userId: string; name: string; status: 'pending-in' | 'pending-out' | 'accepted' }[]
  > {
    const rows = await this.connections.find({
      where: [{ requesterId: userId }, { addresseeId: userId }],
      order: { createdAt: 'DESC' },
    });
    const blocked = await this.blockedIdsEitherWay(userId);

    const out: { userId: string; name: string; status: 'pending-in' | 'pending-out' | 'accepted' }[] = [];
    for (const row of rows) {
      const otherId = row.requesterId === userId ? row.addresseeId : row.requesterId;
      // A blocked pair is not shown at all — neither as a connection nor as a
      // pending request. The block is meant to end the relationship, not to
      // leave a row of it on screen.
      if (blocked.has(otherId)) continue;
      // A deleted account leaves its connection rows behind. Skip it rather
      // than letting one missing user 404 the whole list.
      const other = await this.users.findById(otherId).catch(() => null);
      if (!other) continue;
      out.push({
        userId: otherId,
        name: other.name,
        status:
          row.status === 'accepted'
            ? 'accepted'
            : row.requesterId === userId
              ? 'pending-out'
              : 'pending-in',
      });
    }
    return out;
  }

  // ── blocking ─────────────────────────────────────────────────────

  /**
   * Block someone.
   *
   * The connection row is deleted as well as the block being written. Leaving
   * an accepted connection behind would mean the rule "connected people may
   * message" and the rule "blocked people may not" both apply to the same
   * pair, and the system's answer would depend on which check ran first.
   */
  async block(blockerId: string, blockedId: string): Promise<void> {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }
    await this.blocks
      .createQueryBuilder()
      .insert()
      .values({ blockerId, blockedId })
      .orIgnore()
      .execute();
    await this.connections.delete([
      { requesterId: blockerId, addresseeId: blockedId },
      { requesterId: blockedId, addresseeId: blockerId },
    ]);
  }

  async unblock(blockerId: string, blockedId: string): Promise<void> {
    await this.blocks.delete({ blockerId, blockedId });
  }

  /** Everyone this user has blocked, or who has blocked them. */
  private async blockedIdsEitherWay(userId: string): Promise<Set<string>> {
    const rows = await this.blocks.find({
      where: [{ blockerId: userId }, { blockedId: userId }],
    });
    return new Set(
      rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)),
    );
  }

  private async isBlockedEitherWay(a: string, b: string): Promise<boolean> {
    const count = await this.blocks.count({
      where: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    });
    return count > 0;
  }

  // ── messages ─────────────────────────────────────────────────────

  /**
   * Send a message, or refuse with a reason.
   *
   * The order of the checks is the order of the guarantees: you cannot message
   * yourself, you cannot message someone who has blocked you or whom you have
   * blocked, you cannot message someone you are not connected to, and you
   * cannot send more than a person plausibly sends in a day.
   */
  async send(senderId: string, recipientId: string, body: string): Promise<DirectMessageOrmEntity> {
    const text = body.trim();
    if (!text) throw new BadRequestException('A message cannot be empty');
    if (senderId === recipientId) {
      throw new BadRequestException('You cannot message yourself');
    }

    // Blocked before connected: a blocked pair has no connection row left, and
    // answering "not connected" to someone who was blocked would leak the fact
    // that the block happened.
    if (await this.isBlockedEitherWay(senderId, recipientId)) {
      throw new ForbiddenException('You cannot message this user');
    }
    if (!(await this.areConnected(senderId, recipientId))) {
      throw new ForbiddenException('You can only message connected buddies');
    }

    await this.assertWithinSendLimits(senderId);

    return this.messages.save(
      this.messages.create({ senderId, recipientId, body: text }),
    );
  }

  /**
   * Two windows, both counted from the messages table.
   *
   * The table is the same data the limit is about, so the count cannot drift
   * from reality and cannot be reset by a deploy — which is exactly what an
   * in-process counter offers a spammer willing to wait.
   */
  private async assertWithinSendLimits(senderId: string): Promise<void> {
    const countSince = (since: Date) =>
      this.messages
        .createQueryBuilder('m')
        .where('m."senderId" = :senderId', { senderId })
        .andWhere('m."createdAt" > :since', { since })
        .getCount();

    const minuteAgo = new Date(Date.now() - 60 * 1000);
    if ((await countSince(minuteAgo)) >= BURST_MESSAGE_LIMIT) {
      throw new ForbiddenException('You are sending messages too quickly');
    }
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    if ((await countSince(dayAgo)) >= DAILY_MESSAGE_LIMIT) {
      throw new ForbiddenException('Daily message limit reached');
    }
  }

  /**
   * A conversation, oldest first.
   *
   * The same two rules gate reading. A block therefore takes the history away
   * from both people, which is what "stop past and future messages" has to
   * mean if it is to mean anything — a thread that stays readable after a
   * block is a thread the blocked person can still be quoted from.
   */
  async thread(userId: string, otherId: string, limit = 200): Promise<DirectMessageOrmEntity[]> {
    if (await this.isBlockedEitherWay(userId, otherId)) {
      throw new ForbiddenException('You cannot read this conversation');
    }
    if (!(await this.areConnected(userId, otherId))) {
      throw new ForbiddenException('You can only read conversations with connected buddies');
    }
    return this.messages.find({
      where: [
        { senderId: userId, recipientId: otherId },
        { senderId: otherId, recipientId: userId },
      ],
      order: { createdAt: 'ASC' },
      take: limit,
    });
  }
}
