import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MessagingService } from './messaging.service';
import {
  DirectMessageOrmEntity,
  UserBlockOrmEntity,
  UserConnectionOrmEntity,
} from '../infrastructure/persistence/messaging.orm-entities';
import { UsersService } from '../../users/application/users.service';

/**
 * The rules that decide who may talk to whom.
 *
 * These run against in-memory stand-ins for the three tables rather than a
 * live database, so they test the decisions rather than the SQL — the
 * end-to-end proof that the API really answers 403 lives in the e2e suite.
 * What matters here is that every refusal is asserted by its own case: a test
 * that only checks "an error was thrown" passes just as happily when the error
 * came from a typo.
 */

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';
const CARA = '33333333-3333-3333-3333-333333333333';

/** Minimal repository double: enough of the API this service actually uses. */
function fakeRepo<T extends { id?: string }>(rows: T[] = []) {
  const matches = (row: T, where: Record<string, unknown>) =>
    Object.entries(where).every(([k, v]) => (row as Record<string, unknown>)[k] === v);
  const list = (where: unknown): T[] => {
    const clauses = Array.isArray(where) ? where : [where];
    return rows.filter((r) => clauses.some((c) => matches(r, c as Record<string, unknown>)));
  };
  return {
    rows,
    find: jest.fn(({ where }: { where?: unknown } = {}) =>
      Promise.resolve(where ? list(where) : [...rows]),
    ),
    findOne: jest.fn(({ where }: { where: unknown }) => Promise.resolve(list(where)[0] ?? null)),
    count: jest.fn(({ where }: { where: unknown }) => Promise.resolve(list(where).length)),
    save: jest.fn((row: T) => {
      if (!rows.includes(row)) {
        (row as { id?: string }).id = `id-${rows.length + 1}`;
        rows.push(row);
      }
      return Promise.resolve(row);
    }),
    create: jest.fn((row: T) => ({ ...row, createdAt: new Date() })),
    delete: jest.fn((where: unknown) => {
      for (const row of list(where)) rows.splice(rows.indexOf(row), 1);
      return Promise.resolve({ affected: 1 });
    }),
    createQueryBuilder: jest.fn(() => {
      const qb: Record<string, unknown> = {};
      let pending: T | null = null;
      let senderFilter: string | null = null;
      Object.assign(qb, {
        insert: () => qb,
        values: (v: T) => { pending = v; return qb; },
        orIgnore: () => qb,
        execute: () => {
          if (pending && !rows.some((r) => matches(r, pending as Record<string, unknown>))) {
            rows.push({ ...pending, id: `id-${rows.length + 1}`, createdAt: new Date() } as T);
          }
          return Promise.resolve({});
        },
        where: (_s: string, p: Record<string, string>) => { senderFilter = p.senderId; return qb; },
        andWhere: () => qb,
        getCount: () =>
          Promise.resolve(
            rows.filter((r) => (r as Record<string, unknown>).senderId === senderFilter).length,
          ),
      });
      return qb;
    }),
  } as unknown as Repository<T> & { rows: T[] };
}

function makeService(opts: { knownUsers?: string[] } = {}) {
  const known = new Set(opts.knownUsers ?? [ALICE, BOB, CARA]);
  const connections = fakeRepo<UserConnectionOrmEntity>([]);
  const blocks = fakeRepo<UserBlockOrmEntity>([]);
  const messages = fakeRepo<DirectMessageOrmEntity>([]);
  const users = {
    findById: jest.fn((id: string) =>
      known.has(id)
        ? Promise.resolve({ id, name: `User ${id.slice(0, 4)}` })
        : Promise.reject(new NotFoundException('User not found')),
    ),
  } as unknown as UsersService;
  const service = new MessagingService(connections, blocks, messages, users);
  return { service, connections, blocks, messages };
}

/** Put two people in an accepted connection, the way the API would. */
async function connect(service: MessagingService, a: string, b: string) {
  await service.requestConnection(a, b);
  await service.acceptConnection(b, a);
}

describe('messaging — who may send', () => {
  it('REFUSES a message between two users with no connection at all', async () => {
    const { service, messages } = makeService();
    await expect(service.send(ALICE, BOB, 'hello')).rejects.toBeInstanceOf(ForbiddenException);
    // The refusal must also mean nothing was written.
    expect(messages.rows).toHaveLength(0);
  });

  it('REFUSES a message when the request was sent but never accepted', async () => {
    const { service, messages } = makeService();
    await service.requestConnection(ALICE, BOB);
    // This is the case a "does a row exist?" check would wave through, and it
    // is exactly the one consent is about.
    await expect(service.send(ALICE, BOB, 'hello')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.send(BOB, ALICE, 'hello')).rejects.toBeInstanceOf(ForbiddenException);
    expect(messages.rows).toHaveLength(0);
  });

  it('allows a message once the connection is accepted, in both directions', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await expect(service.send(ALICE, BOB, 'hi')).resolves.toBeDefined();
    await expect(service.send(BOB, ALICE, 'hi back')).resolves.toBeDefined();
  });

  it('REFUSES a message to a third party who is connected to your buddy but not to you', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await connect(service, BOB, CARA);
    await expect(service.send(ALICE, CARA, 'hello')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REFUSES messaging yourself', async () => {
    const { service } = makeService();
    await expect(service.send(ALICE, ALICE, 'note to self')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('REFUSES an empty or whitespace-only message', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await expect(service.send(ALICE, BOB, '   ')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('messaging — blocking', () => {
  it('REFUSES messages in BOTH directions after a block', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await service.send(ALICE, BOB, 'before the block');

    await service.block(ALICE, BOB);

    // The blocker cannot send.
    await expect(service.send(ALICE, BOB, 'after')).rejects.toBeInstanceOf(ForbiddenException);
    // And neither can the blocked person — a block that only stops one
    // direction leaves the person who blocked still receiving.
    await expect(service.send(BOB, ALICE, 'after')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('takes the PAST conversation away from both sides', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await service.send(ALICE, BOB, 'before the block');
    expect(await service.thread(ALICE, BOB)).toHaveLength(1);

    await service.block(BOB, ALICE);

    await expect(service.thread(ALICE, BOB)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.thread(BOB, ALICE)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('REFUSES a fresh connection request from a blocked user', async () => {
    const { service } = makeService();
    await service.block(ALICE, BOB);
    // Otherwise blocking is a speed bump: the blocked user reconnects and the
    // conversation resumes.
    await expect(service.requestConnection(BOB, ALICE)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.requestConnection(ALICE, BOB)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not silently re-enable an old connection when unblocking', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await service.block(ALICE, BOB);
    await service.unblock(ALICE, BOB);
    // The connection was destroyed by the block, so speaking again requires
    // asking again — consent is not restored by the absence of a block.
    await expect(service.send(ALICE, BOB, 'hi again')).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('messaging — connections', () => {
  it('accepts a crossing pair of requests rather than failing on the race', async () => {
    const { service } = makeService();
    await service.requestConnection(ALICE, BOB);
    await service.requestConnection(BOB, ALICE);
    expect(await service.areConnected(ALICE, BOB)).toBe(true);
  });

  it('only the addressee can accept a request', async () => {
    const { service } = makeService();
    await service.requestConnection(ALICE, BOB);
    // The requester accepting their own request would be consent by one party.
    await expect(service.acceptConnection(ALICE, BOB)).rejects.toBeInstanceOf(NotFoundException);
    expect(await service.areConnected(ALICE, BOB)).toBe(false);
  });

  it('a repeated request does not create a second row to accept', async () => {
    const { service, connections } = makeService();
    await service.requestConnection(ALICE, BOB);
    await service.requestConnection(ALICE, BOB);
    expect(connections.rows).toHaveLength(1);
  });

  it('REFUSES a request to an account that does not exist', async () => {
    const { service } = makeService({ knownUsers: [ALICE, BOB] });
    await expect(service.requestConnection(ALICE, CARA)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('hides blocked people from the connection list entirely', async () => {
    const { service } = makeService();
    await connect(service, ALICE, BOB);
    await connect(service, ALICE, CARA);
    await service.block(ALICE, BOB);
    const list = await service.listConnections(ALICE);
    expect(list.map((c) => c.userId)).toEqual([CARA]);
  });
});
