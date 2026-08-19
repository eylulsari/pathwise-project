import { ForbiddenException } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import type { Repository } from 'typeorm';
import type { CurrencyService } from '../../currency/application/currency.service';
import type { MessagingService } from '../../messaging/application/messaging.service';
import type { UsersService } from '../../users/application/users.service';
import type { ExpenseOrmEntity } from '../infrastructure/persistence/expense.orm-entity';

/**
 * The arithmetic lives in domain/settle.spec.ts. What is checked here is the
 * part that is about people rather than money: who may be named in an expense,
 * whose books a row belongs to, and whether a conversion stays honest about
 * where its rate came from.
 */

const ME = 'me';
const BUDDY = 'buddy';
const STRANGER = 'stranger';

function build(opts: { rows?: Partial<ExpenseOrmEntity>[]; rateSource?: string } = {}) {
  const rows: Partial<ExpenseOrmEntity>[] = opts.rows ?? [];
  const deleted: string[] = [];

  const repo = {
    create: (row: Partial<ExpenseOrmEntity>) => row,
    save: (row: Partial<ExpenseOrmEntity>) => {
      const full = { id: 'e1', createdAt: new Date('2026-08-19T10:00:00Z'), ...row };
      rows.push(full);
      return Promise.resolve(full);
    },
    find: () => Promise.resolve(rows),
    findOne: ({ where }: { where: { id: string } }) =>
      Promise.resolve(rows.find((r) => r.id === where.id) ?? null),
    delete: ({ id }: { id: string }) => {
      deleted.push(id);
      return Promise.resolve({ affected: 1 });
    },
  } as unknown as Repository<ExpenseOrmEntity>;

  const service = new ExpensesService(
    repo,
    {
      getRates: () =>
        Promise.resolve({
          base: 'TRY' as const,
          date: '2026-08-19',
          // 1 TRY buys 0.028 EUR, so €1 is about ₺35.71.
          rates: { USD: 0.031, EUR: 0.028, GBP: 0.024 },
          source: (opts.rateSource ?? 'live') as 'live' | 'cache' | 'fallback',
        }),
    } as unknown as CurrencyService,
    {
      // Connected to BUDDY only.
      areConnected: (a: string, b: string) =>
        Promise.resolve([a, b].includes(BUDDY) && [a, b].includes(ME)),
    } as unknown as MessagingService,
    {
      findById: (id: string) =>
        id === STRANGER
          ? Promise.reject(new Error('not found'))
          : Promise.resolve({ name: id === ME ? 'Me' : 'Buddy' }),
    } as unknown as UsersService,
  );

  return { service, rows, deleted };
}

const baseDto = {
  dayIndex: 0,
  category: 'food' as const,
  amount: 300,
  currency: 'TRY' as const,
};

describe('ExpensesService — who may be named', () => {
  it('accepts an expense shared with a connected buddy', async () => {
    const { service } = build();
    const view = await service.add(ME, { ...baseDto, participantIds: [ME, BUDDY] });
    expect(view.participantIds).toEqual([ME, BUDDY]);
  });

  it('refuses to attach a stranger to a debt', async () => {
    // Otherwise the ledger becomes a way to put anyone's name against money
    // they never agreed to. It is the same consent rule as messaging.
    const { service } = build();
    await expect(
      service.add(ME, { ...baseDto, participantIds: [ME, STRANGER] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('refuses to record that a stranger paid', async () => {
    const { service } = build();
    await expect(
      service.add(ME, { ...baseDto, paidByUserId: STRANGER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets a personal expense name nobody at all', async () => {
    const { service } = build();
    const view = await service.add(ME, baseDto);
    expect(view.participantIds).toEqual([]);
    expect(view.paidByUserId).toBe(ME);
  });

  it('does not double-charge a buddy listed twice', async () => {
    const { service } = build();
    const view = await service.add(ME, {
      ...baseDto,
      participantIds: [BUDDY, BUDDY, ME],
    });
    expect(view.participantIds).toEqual([BUDDY, ME]);
  });
});

describe('ExpensesService — the money', () => {
  it('records what was typed alongside the lira it converted to', async () => {
    const { service } = build();
    const view = await service.add(ME, { ...baseDto, amount: 40, currency: 'EUR' });

    // €40 at 1/0.028 ≈ ₺1428.57 — and the euro figure is still in the record.
    expect(view.enteredAmount).toBe(40);
    expect(view.enteredCurrency).toBe('EUR');
    expect(view.amountTry).toBeCloseTo(1428.57, 2);
    expect(view.rateToTry).toBeCloseTo(35.714286, 4);
  });

  it('says when the rate was not a live one', async () => {
    // A fallback rate is a guess from a static table. The UI labels it, which
    // it can only do if the server admits it.
    const { service } = build({ rateSource: 'fallback' });
    const view = await service.add(ME, { ...baseDto, amount: 10, currency: 'USD' });
    expect(view.rateSource).toBe('fallback');
  });

  it('quotes no rate at all for an amount already in lira', async () => {
    const { service } = build();
    const view = await service.add(ME, baseDto);
    expect(view.rateToTry).toBeNull();
    expect(view.amountTry).toBe(300);
  });

  it('totals by day and by category, and settles the group', async () => {
    const { service } = build();
    await service.add(ME, { ...baseDto, amount: 300, participantIds: [ME, BUDDY] });
    await service.add(ME, { ...baseDto, dayIndex: 1, category: 'tickets', amount: 100 });

    const ledger = await service.ledger(ME);
    expect(ledger.totalTry).toBe(400);
    expect(ledger.spentByDayTry).toEqual({ 0: 300, 1: 100 });
    expect(ledger.byCategoryTry).toEqual({ food: 300, tickets: 100 });
    // The buddy owes half the shared meal, and nothing toward the ticket the
    // owner bought for themselves.
    expect(ledger.debts).toEqual([{ fromId: BUDDY, toId: ME, amountTry: 150 }]);
  });

  it('never promises to move the money it just counted', async () => {
    const { service } = build();
    const ledger = await service.ledger(ME);
    expect(ledger.settlementIsRecordOnly).toBe(true);
  });
});

describe('ExpensesService — whose books', () => {
  it('refuses to delete somebody else’s row', async () => {
    const { service, deleted } = build({
      rows: [{ id: 'e9', userId: BUDDY, participantIds: [] }],
    });
    await expect(service.remove(ME, 'e9')).rejects.toBeInstanceOf(ForbiddenException);
    expect(deleted).toEqual([]);
  });

  it('deletes your own', async () => {
    const { service, deleted } = build({
      rows: [{ id: 'e9', userId: ME, participantIds: [] }],
    });
    await service.remove(ME, 'e9');
    expect(deleted).toEqual(['e9']);
  });
});
