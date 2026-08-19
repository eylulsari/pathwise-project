/**
 * Who owes whom, after a trip where people paid for each other.
 *
 * ⚠️ ACCOUNTING ONLY. Nothing here moves money, and nothing in this project
 * does. The output is a list of amounts the group can settle however they
 * already settle things. Pathwise holds no funds, initiates no transfer and
 * takes no payment risk — the same call made for tours, where we link out to
 * an operator rather than sell the ticket ourselves.
 *
 * EVERYTHING IS IN KURUŞ
 * Integers, not lira floats. An equal split of ₺10.00 three ways is not three
 * equal shares; in floating point it is three shares of 3.3333… that add up to
 * 9.999999999999998, and after a few dozen expenses the balances no longer sum
 * to zero. Working in the smallest unit and handing out the remainder
 * explicitly keeps the books closed.
 */

export interface ShareableExpense {
  /** Total paid, in kuruş. */
  amountKurus: number;
  /** Who actually paid the bill. */
  paidBy: string;
  /**
   * Who the expense is shared between. An empty list means it was nobody
   * else's — a personal expense, which belongs in the budget but creates no
   * debt.
   */
  participants: string[];
}

export interface Balance {
  personId: string;
  /** Positive: the group owes them. Negative: they owe the group. */
  netKurus: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amountKurus: number;
}

/**
 * Split one expense between its participants, in kuruş, with the remainder
 * handed out one kuruş at a time rather than rounded away.
 *
 * Returned in the same order as `participants`, so the person who gets the
 * extra kuruş is decided by the caller's order and not by chance.
 */
export function splitEvenly(amountKurus: number, participants: number): number[] {
  if (participants <= 0) return [];
  const base = Math.floor(amountKurus / participants);
  const remainder = amountKurus - base * participants;
  return Array.from({ length: participants }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * Net position per person. Sums to zero by construction — every kuruş charged
 * to a participant is credited to whoever paid it.
 */
export function balances(expenses: ShareableExpense[]): Balance[] {
  const net = new Map<string, number>();
  const bump = (id: string, delta: number) => net.set(id, (net.get(id) ?? 0) + delta);

  for (const e of expenses) {
    // A personal expense: recorded for the budget, owed by nobody.
    if (e.participants.length === 0) continue;

    const shares = splitEvenly(e.amountKurus, e.participants.length);
    e.participants.forEach((p, i) => bump(p, -shares[i]));
    bump(e.paidBy, e.amountKurus);
  }

  return [...net.entries()]
    .map(([personId, netKurus]) => ({ personId, netKurus }))
    .filter((b) => b.netKurus !== 0)
    .sort((a, b) => b.netKurus - a.netKurus || a.personId.localeCompare(b.personId));
}

/**
 * The transfers that clear those balances, fewest first.
 *
 * Greedy largest-debtor-to-largest-creditor. It does not always find the
 * theoretical minimum number of transfers — that problem is NP-hard — but it
 * never exceeds one fewer than the number of people with a balance, and it
 * settles the group exactly. What it must never do is invent or lose a kuruş,
 * which is what the tests hold it to.
 */
export function settle(input: Balance[]): Transfer[] {
  const creditors = input.filter((b) => b.netKurus > 0).map((b) => ({ ...b }));
  const debtors = input.filter((b) => b.netKurus < 0).map((b) => ({ ...b }));

  // Largest first on both sides, ties broken by id so the result is stable.
  creditors.sort((a, b) => b.netKurus - a.netKurus || a.personId.localeCompare(b.personId));
  debtors.sort((a, b) => a.netKurus - b.netKurus || a.personId.localeCompare(b.personId));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const credit = creditors[ci];
    const debt = debtors[di];
    const amount = Math.min(credit.netKurus, -debt.netKurus);

    if (amount > 0) {
      transfers.push({ fromId: debt.personId, toId: credit.personId, amountKurus: amount });
      credit.netKurus -= amount;
      debt.netKurus += amount;
    }

    if (credit.netKurus === 0) ci++;
    if (debt.netKurus === 0) di++;
  }

  return transfers;
}
