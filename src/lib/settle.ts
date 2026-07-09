import type { ExpenseRecord } from '../models/types';

/**
 * 分帳結算：計算每個成員在每種幣別下的淨額。
 * 正數 = 應收回，負數 = 應付。每筆開銷由付款人 + splitWithIds 平均分攤。
 */
export function computeBalances(expenses: ExpenseRecord[]): Map<string, Map<string, number>> {
  const balances = new Map<string, Map<string, number>>();
  const add = (memberId: string, currency: string, delta: number) => {
    const byCurrency = balances.get(memberId) ?? new Map<string, number>();
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + delta);
    balances.set(memberId, byCurrency);
  };

  for (const ex of expenses) {
    const share = ex.amount / (ex.splitWithIds.length + 1); // +1 = 付款人本人
    add(ex.paidById, ex.currency, ex.amount - share);
    for (const id of ex.splitWithIds) add(id, ex.currency, -share);
  }
  return balances;
}
