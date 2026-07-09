import { describe, expect, it, test } from 'vitest';
import { computeBalances } from '../src/lib/settle';
import type { ExpenseRecord } from '../src/models/types';

let counter = 0;
function expense(partial: Partial<ExpenseRecord>): ExpenseRecord {
  return {
    id: `e${counter++}`,
    tripId: 't1',
    amount: 100,
    currency: 'TWD',
    category: 'food',
    description: '',
    paidById: 'self',
    splitWithIds: [],
    date: '2026-07-09',
    createdAt: new Date().toISOString(),
    ...partial,
  };
}

describe('computeBalances 基本情境', () => {
  it('自己付自己吃 → 淨額 0', () => {
    const b = computeBalances([expense({ amount: 500 })]);
    expect(b.get('self')?.get('TWD')).toBe(0);
  });

  it('兩人均分 → 付款人 +一半、對方 -一半', () => {
    const b = computeBalances([expense({ amount: 3000, currency: 'JPY', splitWithIds: ['a'] })]);
    expect(b.get('self')?.get('JPY')).toBe(1500);
    expect(b.get('a')?.get('JPY')).toBe(-1500);
  });

  it('三人分帳', () => {
    const b = computeBalances([expense({ amount: 900, splitWithIds: ['a', 'b'] })]);
    expect(b.get('self')?.get('TWD')).toBeCloseTo(600);
    expect(b.get('a')?.get('TWD')).toBeCloseTo(-300);
    expect(b.get('b')?.get('TWD')).toBeCloseTo(-300);
  });

  it('多幣別分開結算', () => {
    const b = computeBalances([
      expense({ amount: 1000, currency: 'TWD', splitWithIds: ['a'] }),
      expense({ amount: 2000, currency: 'JPY', splitWithIds: ['self'], paidById: 'a' }),
    ]);
    expect(b.get('self')?.get('TWD')).toBe(500);
    expect(b.get('self')?.get('JPY')).toBe(-1000);
    expect(b.get('a')?.get('TWD')).toBe(-500);
    expect(b.get('a')?.get('JPY')).toBe(1000);
  });

  it('互欠可以抵銷', () => {
    const b = computeBalances([
      expense({ amount: 1000, paidById: 'self', splitWithIds: ['a'] }),
      expense({ amount: 1000, paidById: 'a', splitWithIds: ['self'] }),
    ]);
    expect(b.get('self')?.get('TWD')).toBeCloseTo(0);
    expect(b.get('a')?.get('TWD')).toBeCloseTo(0);
  });

  it('空清單 → 空結果', () => {
    expect(computeBalances([]).size).toBe(0);
  });
});

/* ===== 守恆性質：任何情境下每種幣別的淨額總和必為 0 ===== */
describe('computeBalances 守恆性質（隨機情境）', () => {
  // 可重現的偽隨機數
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };

  const members = ['self', 'a', 'b', 'c', 'd'];
  const currencies = ['TWD', 'JPY', 'KRW'];
  const scenarios = Array.from({ length: 700 }, (_, i) => i);

  test.each(scenarios)('隨機情境 #%i 淨額守恆', () => {
    const n = 1 + Math.floor(rand() * 8);
    const expenses: ExpenseRecord[] = [];
    for (let i = 0; i < n; i++) {
      const payer = members[Math.floor(rand() * members.length)];
      const others = members.filter((m) => m !== payer);
      const splitCount = Math.floor(rand() * others.length);
      expenses.push(
        expense({
          amount: Math.round(rand() * 100000) / 10,
          currency: currencies[Math.floor(rand() * currencies.length)],
          paidById: payer,
          splitWithIds: others.slice(0, splitCount),
        }),
      );
    }

    const balances = computeBalances(expenses);
    const sums = new Map<string, number>();
    for (const byCurrency of balances.values()) {
      for (const [currency, v] of byCurrency) {
        sums.set(currency, (sums.get(currency) ?? 0) + v);
      }
    }
    for (const total of sums.values()) {
      expect(Math.abs(total)).toBeLessThan(1e-6);
    }
  });
});
