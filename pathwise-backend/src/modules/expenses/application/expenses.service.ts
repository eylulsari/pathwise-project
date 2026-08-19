import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CurrencyService,
  SUPPORTED_SYMBOLS,
} from '../../currency/application/currency.service';
import { MessagingService } from '../../messaging/application/messaging.service';
import { UsersService } from '../../users/application/users.service';
import { ExpenseOrmEntity } from '../infrastructure/persistence/expense.orm-entity';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { balances, settle, type ShareableExpense } from '../domain/settle';

export interface ExpenseView {
  id: string;
  dayIndex: number;
  category: string;
  placeId: string | null;
  placeName: string | null;
  note: string | null;
  amountTry: number;
  enteredAmount: number;
  enteredCurrency: string;
  /** Only set when the entry was not already in lira. */
  rateToTry: number | null;
  rateSource: string;
  paidByUserId: string;
  participantIds: string[];
  createdAt: string;
}

export interface DebtView {
  fromId: string;
  toId: string;
  amountTry: number;
}

export interface ExpenseLedger {
  expenses: ExpenseView[];
  /** Total per day index, in lira. */
  spentByDayTry: Record<number, number>;
  totalTry: number;
  /** Total per category, in lira. */
  byCategoryTry: Record<string, number>;
  debts: DebtView[];
  /** Display names for every id that appears above. */
  names: Record<string, string>;
  /**
   * Always true, and sent so this screen cannot be rendered without it.
   * Pathwise records who owes whom; it never moves money.
   */
  settlementIsRecordOnly: true;
}

const toTry = (kurus: number): number => Math.round(kurus) / 100;

/**
 * The trip ledger.
 *
 * NO PAYMENTS, DELIBERATELY. This computes who owes whom and stops there.
 * Pathwise holds no funds, moves no money and stores no payment credential —
 * the same call taken for tours, where the booking happens on the operator's
 * site rather than ours. Handling money would put licensing, refunds and
 * chargebacks in the middle of a trip-planning app, for a group of friends who
 * already have a way to pay each other back.
 *
 * WHOSE LEDGER IT IS
 * One per account, and private to it. Naming a buddy in an expense records
 * YOUR account of the trip; it does not write to their ledger, notify them, or
 * bind them to anything. Two people who both keep books will have two sets,
 * which is what a shared record without a shared agreement actually is. The
 * one rule enforced is that you can only name people you are connected to, so
 * the feature cannot be used to attach a stranger's name to a debt.
 */
@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(ExpenseOrmEntity)
    private readonly repo: Repository<ExpenseOrmEntity>,
    private readonly currency: CurrencyService,
    private readonly messaging: MessagingService,
    private readonly users: UsersService,
  ) {}

  async add(userId: string, dto: CreateExpenseDto): Promise<ExpenseView> {
    const paidBy = dto.paidByUserId ?? userId;
    const participants = [...new Set(dto.participantIds ?? [])];

    // Everyone named has to be someone this account is actually connected to.
    // Without this, a ledger could quietly attach any user id to a debt.
    await this.assertKnown(userId, [paidBy, ...participants]);

    const { amountKurus, rateToTry, rateSource } = await this.convert(
      dto.amount,
      dto.currency,
    );

    const saved = await this.repo.save(
      this.repo.create({
        userId,
        dayIndex: dto.dayIndex,
        category: dto.category,
        placeId: dto.placeId ?? null,
        placeName: dto.placeName ?? null,
        note: dto.note ?? null,
        amountKurus: String(amountKurus),
        enteredAmount: dto.amount.toFixed(2),
        enteredCurrency: dto.currency,
        rateToTry: rateToTry.toFixed(6),
        rateSource,
        paidByUserId: paidBy,
        participantIds: participants,
      }),
    );

    return this.toView(saved);
  }

  async remove(userId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Expense not found');
    // Checked rather than folded into the delete criteria, so deleting someone
    // else's row is refused outright instead of reported as "not found".
    if (row.userId !== userId) throw new ForbiddenException('Not your expense');
    await this.repo.delete({ id });
  }

  async ledger(userId: string): Promise<ExpenseLedger> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const spentByDayKurus: Record<number, number> = {};
    const byCategoryKurus: Record<string, number> = {};
    let totalKurus = 0;

    for (const row of rows) {
      const kurus = Number(row.amountKurus);
      totalKurus += kurus;
      spentByDayKurus[row.dayIndex] = (spentByDayKurus[row.dayIndex] ?? 0) + kurus;
      byCategoryKurus[row.category] = (byCategoryKurus[row.category] ?? 0) + kurus;
    }

    const shareable: ShareableExpense[] = rows.map((row) => ({
      amountKurus: Number(row.amountKurus),
      paidBy: row.paidByUserId,
      participants: row.participantIds ?? [],
    }));
    const debts = settle(balances(shareable)).map((t) => ({
      fromId: t.fromId,
      toId: t.toId,
      amountTry: toTry(t.amountKurus),
    }));

    return {
      expenses: rows.map((row) => this.toView(row)),
      spentByDayTry: mapValues(spentByDayKurus, toTry),
      totalTry: toTry(totalKurus),
      byCategoryTry: mapValues(byCategoryKurus, toTry),
      debts,
      names: await this.resolveNames(rows),
      settlementIsRecordOnly: true,
    };
  }

  /**
   * Lira, in kuruş, plus the rate that got us there.
   *
   * The rate is recorded with the row rather than applied at read time: a
   * dinner split last week should not change amount because the euro moved
   * since. `rateSource` says whether the number came from the live feed, the
   * hour-long cache, or the static fallback table — the UI says so when a
   * conversion is not from a live rate.
   */
  private async convert(
    amount: number,
    currency: string,
  ): Promise<{ amountKurus: number; rateToTry: number; rateSource: string }> {
    if (currency === 'TRY') {
      return { amountKurus: Math.round(amount * 100), rateToTry: 1, rateSource: 'none' };
    }

    const symbol = currency as (typeof SUPPORTED_SYMBOLS)[number];
    const { rates, source } = await this.currency.getRates();
    const perTry = rates[symbol];
    // The feed gives "how much of X one lira buys", so a lira price is the
    // reciprocal. A zero would mean a broken payload, not a free dinner.
    if (!perTry || perTry <= 0) {
      throw new BadRequestException(`No usable exchange rate for ${currency}`);
    }

    const rateToTry = 1 / perTry;
    return {
      amountKurus: Math.round(amount * rateToTry * 100),
      rateToTry,
      rateSource: source,
    };
  }

  /** Refuse any id that is neither the caller nor an accepted connection. */
  private async assertKnown(userId: string, ids: string[]): Promise<void> {
    for (const id of new Set(ids)) {
      if (id === userId) continue;
      if (!(await this.messaging.areConnected(userId, id))) {
        throw new ForbiddenException(
          'Expenses can only be shared with connected buddies',
        );
      }
    }
  }

  /**
   * Names for the ids in the ledger. A buddy who has since disconnected still
   * has to render as somebody — a settlement line reading "you owe <uuid>" is
   * worse than useless.
   */
  private async resolveNames(
    rows: ExpenseOrmEntity[],
  ): Promise<Record<string, string>> {
    const ids = new Set<string>();
    for (const row of rows) {
      ids.add(row.paidByUserId);
      for (const p of row.participantIds ?? []) ids.add(p);
    }

    const names: Record<string, string> = {};
    await Promise.all(
      [...ids].map(async (id) => {
        try {
          names[id] = (await this.users.findById(id)).name;
        } catch {
          // Deleted account. The debt is still real to whoever recorded it.
          names[id] = 'Former buddy';
        }
      }),
    );
    return names;
  }

  private toView(row: ExpenseOrmEntity): ExpenseView {
    return {
      id: row.id,
      dayIndex: row.dayIndex,
      category: row.category,
      placeId: row.placeId,
      placeName: row.placeName,
      note: row.note,
      amountTry: toTry(Number(row.amountKurus)),
      enteredAmount: Number(row.enteredAmount),
      enteredCurrency: row.enteredCurrency,
      rateToTry: row.enteredCurrency === 'TRY' ? null : Number(row.rateToTry),
      rateSource: row.rateSource,
      paidByUserId: row.paidByUserId,
      participantIds: row.participantIds ?? [],
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function mapValues<K extends string | number>(
  input: Record<K, number>,
  fn: (n: number) => number,
): Record<K, number> {
  const out = {} as Record<K, number>;
  for (const key of Object.keys(input) as K[]) out[key] = fn(input[key]);
  return out;
}
