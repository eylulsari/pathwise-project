import { balances, settle, splitEvenly, type ShareableExpense } from './settle';

/**
 * The property that matters is that the books close: no kuruş is invented, and
 * none disappears. Everything else is convenience.
 */

const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

describe('splitEvenly', () => {
  it('splits a clean amount cleanly', () => {
    expect(splitEvenly(90_00, 3)).toEqual([30_00, 30_00, 30_00]);
  });

  it('hands out the remainder instead of rounding it away', () => {
    // ₺10.00 three ways is 3.34 + 3.33 + 3.33 — not 3.33 three times, which
    // would quietly lose a kuruş on every such expense.
    const shares = splitEvenly(10_00, 3);
    expect(shares).toEqual([334, 333, 333]);
    expect(sum(shares)).toBe(10_00);
  });

  it('never loses a kuruş, for any split', () => {
    for (let amount = 0; amount < 500; amount++) {
      for (let people = 1; people <= 7; people++) {
        expect(sum(splitEvenly(amount, people))).toBe(amount);
      }
    }
  });

  it('splits nothing between nobody', () => {
    expect(splitEvenly(100, 0)).toEqual([]);
  });
});

describe('balances', () => {
  it('charges the sharers and credits the payer', () => {
    const expenses: ShareableExpense[] = [
      { amountKurus: 300_00, paidBy: 'a', participants: ['a', 'b', 'c'] },
    ];
    expect(balances(expenses)).toEqual([
      { personId: 'a', netKurus: 200_00 },
      { personId: 'b', netKurus: -100_00 },
      { personId: 'c', netKurus: -100_00 },
    ]);
  });

  it('leaves a personal expense out of the debts entirely', () => {
    // Bought a souvenir for themselves. It belongs in the budget, and nobody
    // owes anybody for it.
    const expenses: ShareableExpense[] = [
      { amountKurus: 500_00, paidBy: 'a', participants: [] },
    ];
    expect(balances(expenses)).toEqual([]);
  });

  it('does not charge someone who was not there', () => {
    const expenses: ShareableExpense[] = [
      { amountKurus: 200_00, paidBy: 'a', participants: ['a', 'b'] },
      { amountKurus: 200_00, paidBy: 'c', participants: ['c'] },
    ];
    const net = balances(expenses);
    expect(net.find((b) => b.personId === 'c')).toBeUndefined();
  });

  it('nets out when everyone paid for everyone in turn', () => {
    const expenses: ShareableExpense[] = [
      { amountKurus: 100_00, paidBy: 'a', participants: ['a', 'b'] },
      { amountKurus: 100_00, paidBy: 'b', participants: ['a', 'b'] },
    ];
    expect(balances(expenses)).toEqual([]);
  });

  it('always sums to zero', () => {
    const expenses: ShareableExpense[] = [
      { amountKurus: 1234_57, paidBy: 'a', participants: ['a', 'b', 'c'] },
      { amountKurus: 99_99, paidBy: 'b', participants: ['b', 'c'] },
      { amountKurus: 7_01, paidBy: 'c', participants: ['a', 'c'] },
      { amountKurus: 60_00, paidBy: 'a', participants: [] },
    ];
    expect(sum(balances(expenses).map((b) => b.netKurus))).toBe(0);
  });
});

describe('settle', () => {
  it('clears a simple debt in one transfer', () => {
    expect(settle([
      { personId: 'a', netKurus: 100_00 },
      { personId: 'b', netKurus: -100_00 },
    ])).toEqual([{ fromId: 'b', toId: 'a', amountKurus: 100_00 }]);
  });

  it('does not route money through a third person who owes nothing', () => {
    // b's position is already clear, so b appears in no transfer.
    const transfers = settle([
      { personId: 'a', netKurus: 50_00 },
      { personId: 'c', netKurus: -50_00 },
    ]);
    expect(transfers.some((t) => t.fromId === 'b' || t.toId === 'b')).toBe(false);
  });

  it('settles a three-way group exactly, and everyone ends at zero', () => {
    const input = [
      { personId: 'a', netKurus: 200_00 },
      { personId: 'b', netKurus: -100_00 },
      { personId: 'c', netKurus: -100_00 },
    ];
    const transfers = settle(input);

    const after = new Map(input.map((b) => [b.personId, b.netKurus]));
    for (const t of transfers) {
      after.set(t.fromId, (after.get(t.fromId) ?? 0) + t.amountKurus);
      after.set(t.toId, (after.get(t.toId) ?? 0) - t.amountKurus);
    }
    expect([...after.values()].every((v) => v === 0)).toBe(true);
    expect(transfers).toHaveLength(2);
  });

  it('needs no more than one transfer fewer than there are people', () => {
    const input = [
      { personId: 'a', netKurus: 700_00 },
      { personId: 'b', netKurus: -300_00 },
      { personId: 'c', netKurus: -250_00 },
      { personId: 'd', netKurus: -150_00 },
      { personId: 'e', netKurus: 0 },
    ];
    expect(settle(input).length).toBeLessThanOrEqual(input.length - 1);
  });

  it('moves nothing when nobody owes anything', () => {
    expect(settle([])).toEqual([]);
    expect(settle([{ personId: 'a', netKurus: 0 }])).toEqual([]);
  });

  it('settles the odd-kuruş case the split produces', () => {
    // ₺10.00 paid by a, split three ways: b and c owe 3.33 each.
    const net = balances([
      { amountKurus: 10_00, paidBy: 'a', participants: ['a', 'b', 'c'] },
    ]);
    const transfers = settle(net);
    expect(transfers.reduce((s, t) => s + t.amountKurus, 0)).toBe(666);
  });
});
