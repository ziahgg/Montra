import { describe, expect, it } from 'vitest';

import { monthRange } from '@/domain/dates';
import { balances, budgetProgress, budgetSummary, change, goalProgress, netWorth, periodTotals, spendingByCategory, weeklySpending } from '@/domain/finance';
import { buildSeed } from './seed';

const data = buildSeed();
const today = '2026-10-26';
const oct = monthRange('2026-10');
const sep = monthRange('2026-09');

describe('seed reconciles with the Figma reference figures', () => {
  it('October income $6,350.00 and expenses $3,020.40; net +$3,329.60', () => {
    expect(periodTotals(data.transactions, oct, 'USD')).toMatchObject({ income: 635_000, expenses: 302_040, net: 332_960 });
  });

  it('compares with September: income ↑22.1%, expenses ↓2.7%', () => {
    const s = periodTotals(data.transactions, sep, 'USD');
    expect(change(635_000, s.income)).toBe(22.1);
    expect(change(302_040, s.expenses)).toBe(-2.7);
  });

  it('category totals match the Spending by Category screen and reconcile', () => {
    const cats = spendingByCategory(data.transactions, oct, 'USD');
    expect(cats.map((c) => [c.categoryId, c.amount])).toEqual([
      ['housing', 165_000],
      ['groceries', 41_260],
      ['dining', 28_640],
      ['shopping', 21_499],
      ['bills', 19_875],
      ['transport', 14_820],
      ['health', 6_500],
      ['subscriptions', 4_446],
    ]);
    expect(cats.reduce((s, c) => s + c.amount, 0)).toBe(302_040);
    expect(Math.round(cats[0].share * 1000) / 10).toBe(54.6);
  });

  it('budgets: $1,370.40 spent of $1,670.00, $299.60 left, $59.92 per day', () => {
    expect(budgetSummary(data.budgets, data.transactions, today, 'USD')).toMatchObject({ spent: 137_040, limit: 167_000, remaining: 29_960, perDayLeft: 5_992, daysLeft: 5 });
  });

  it('per-budget states match the design', () => {
    const state = (id: string) => budgetProgress(data.budgets.find((b) => b.id === id)!, data.transactions, today);
    expect(state('b-dining')).toMatchObject({ spent: 28_640, state: 'over', remaining: -3_640 });
    expect(state('b-groceries')).toMatchObject({ spent: 41_260, state: 'near', remaining: 8_740 });
    expect(state('b-bills')).toMatchObject({ spent: 19_875, state: 'on-track' });
    expect(state('b-dining').transactions).toHaveLength(8);
  });

  it('dining weekly spending matches the Budget Details chart', () => {
    const dining = data.budgets.find((b) => b.id === 'b-dining')!;
    const weeks = weeklySpending(dining, data.transactions, { start: '2026-10-01', end: '2026-10-26' });
    // Oct 1 is a Thursday; the design groups Oct 1–7, 8–14, 15–21, 22–26.
    const byDesign = [
      ['2026-10-01', '2026-10-07'],
      ['2026-10-08', '2026-10-14'],
      ['2026-10-15', '2026-10-21'],
      ['2026-10-22', '2026-10-26'],
    ].map(([start, end]) =>
      data.transactions.filter((t) => t.categoryId === 'dining' && t.at.slice(0, 10) >= start && t.at.slice(0, 10) <= end).reduce((s, t) => s + t.amount, 0),
    );
    expect(byDesign).toEqual([4_600, 10_285, 10_590, 3_165]);
    expect(weeks.reduce((s, w) => s + w.amount, 0)).toBe(28_640);
  });

  it('accounts: net $19,758.20, assets $21,006.50, owed −$1,248.30', () => {
    const bal = balances(data);
    expect(bal.get('a-checking')).toBe(842_050);
    expect(bal.get('a-savings')).toBe(1_230_000);
    expect(bal.get('a-cash')).toBe(28_600);
    expect(bal.get('a-card')).toBe(-124_830);
    expect(netWorth(data)).toEqual([{ currency: 'USD', net: 1_975_820, assets: 2_100_650, owed: -124_830, accounts: 4 }]);
  });

  it('savings: $12,300 across three goals (64%, 65%, 25%)', () => {
    const p = data.goals.map((g) => goalProgress(g, data.transactions, today));
    expect(p.map((x) => x.saved)).toEqual([960_000, 156_000, 114_000]);
    expect(p.reduce((s, x) => s + x.saved, 0)).toBe(1_230_000);
    expect(p.map((x) => Math.round(x.progress * 100))).toEqual([64, 65, 25]);
    expect(p[0].projected).toBe('2027-07');
  });

  it('checking money out in October is $2,940.50 (expenses + transfers out)', () => {
    const out = data.transactions
      .filter((t) => t.accountId === 'a-checking' && t.at.startsWith('2026-10') && (t.type === 'expense' || t.type === 'transfer'))
      .reduce((s, t) => s + t.amount, 0);
    expect(out).toBe(294_050);
  });
});
