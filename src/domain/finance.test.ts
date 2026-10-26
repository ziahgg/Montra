import { describe, expect, it } from 'vitest';

import { buildSeed } from '@/data/seed';
import { addBudget, addContribution, addGoal, addTransaction, deleteBudget, deleteGoal, deleteTransaction, markAllRead, restoreTransaction, updateBudget, updateTransaction, ValidationError, type Ctx } from './actions';
import { monthRange } from './dates';
import { balances, budgetPeriod, budgetProgress, goalProgress, netWorth, periodTotals, spendingByCategory } from './finance';
import { parseAmount } from './money';
import type { MontraData } from './types';

let n = 0;
const ctx = (now = '2026-10-26T09:00'): Ctx => ({ stamp: '2026-10-26T09:00:00.000Z', now, id: () => `x-${++n}` });
const fresh = (): MontraData => buildSeed();
const bal = (d: MontraData, id: string) => balances(d).get(id)!;
const oct = monthRange('2026-10');

const expense = (amount: number, over: Partial<Parameters<typeof addTransaction>[1]> = {}) => ({
  type: 'expense' as const,
  amount,
  description: 'Test Cafe',
  categoryId: 'dining',
  accountId: 'a-checking',
  toAccountId: null,
  at: '2026-10-26T10:00',
  note: '',
  ...over,
});

describe('transactions and balances', () => {
  it('an expense decreases its account; income increases it', () => {
    const d0 = fresh();
    const d1 = addTransaction(d0, expense(1_000), ctx()).data;
    expect(bal(d1, 'a-checking')).toBe(bal(d0, 'a-checking') - 1_000);
    const d2 = addTransaction(d1, { ...expense(50_000), type: 'income', categoryId: 'freelance', description: 'Client' }, ctx()).data;
    expect(bal(d2, 'a-checking')).toBe(bal(d1, 'a-checking') + 50_000);
  });

  it('a transfer moves money between accounts without changing net worth or spending', () => {
    const d0 = fresh();
    const d1 = addTransaction(d0, { ...expense(20_000), type: 'transfer', categoryId: null, accountId: 'a-checking', toAccountId: 'a-cash', description: '' }, ctx()).data;
    expect(bal(d1, 'a-checking')).toBe(bal(d0, 'a-checking') - 20_000);
    expect(bal(d1, 'a-cash')).toBe(bal(d0, 'a-cash') + 20_000);
    expect(netWorth(d1)[0].net).toBe(netWorth(d0)[0].net);
    expect(periodTotals(d1.transactions, oct, 'USD')).toEqual(periodTotals(d0.transactions, oct, 'USD'));
  });

  it('editing replaces the previous effect instead of adding to it', () => {
    const d0 = fresh();
    const { data: d1, transaction } = addTransaction(d0, expense(1_000), ctx());
    const d2 = updateTransaction(d1, transaction.id, expense(2_500, { accountId: 'a-card' }), ctx()).data;
    expect(bal(d2, 'a-checking')).toBe(bal(d0, 'a-checking'));
    expect(bal(d2, 'a-card')).toBe(bal(d0, 'a-card') - 2_500);
    expect(periodTotals(d2.transactions, oct, 'USD').expenses).toBe(periodTotals(d0.transactions, oct, 'USD').expenses + 2_500);
  });

  it('deleting reverses the effect everywhere, and undo restores it', () => {
    const d0 = fresh();
    const { data: d1, transaction } = addTransaction(d0, expense(1_000), ctx());
    const { data: d2, removed } = deleteTransaction(d1, transaction.id);
    expect(bal(d2, 'a-checking')).toBe(bal(d0, 'a-checking'));
    expect(budgetProgress(d2.budgets[0], d2.transactions, '2026-10-26').spent).toBe(28_640);
    expect(bal(restoreTransaction(d2, removed), 'a-checking')).toBe(bal(d1, 'a-checking'));
  });

  it('rejects zero, negative and malformed amounts and invalid inputs', () => {
    expect(() => addTransaction(fresh(), expense(0), ctx())).toThrow(ValidationError);
    expect(() => addTransaction(fresh(), expense(-100), ctx())).toThrow(ValidationError);
    expect(() => addTransaction(fresh(), expense(10.5), ctx())).toThrow(ValidationError);
    expect(() => addTransaction(fresh(), expense(100, { categoryId: 'salary' }), ctx())).toThrow(/expense category/);
    expect(() => addTransaction(fresh(), expense(100, { description: ' ' }), ctx())).toThrow(/merchant/);
    expect(() => addTransaction(fresh(), { ...expense(100), type: 'transfer', categoryId: null, toAccountId: 'a-checking' }, ctx())).toThrow(/different account/);
    expect(() => addTransaction(fresh(), expense(100, { at: '2026-02-30T10:00' }), ctx())).toThrow(/date/);
    expect(parseAmount('12.755', 'USD')).toBeNull();
    expect(parseAmount('1,234.5', 'USD')).toBe(123_450);
    expect(parseAmount('abc', 'USD')).toBeNull();
  });

  it('does not mix currencies in net worth', () => {
    const d = fresh();
    d.accounts.push({ ...d.accounts[2], id: 'a-eur', name: 'Euro cash', currency: 'EUR', openingBalance: 5_000 });
    const nw = netWorth(d);
    expect(nw.find((x) => x.currency === 'USD')!.net).toBe(1_975_820);
    expect(nw.find((x) => x.currency === 'EUR')!.net).toBe(5_000);
  });
});

describe('budgets', () => {
  it('count only eligible expenses in the period: not income, transfers, other categories or other months', () => {
    const d0 = fresh();
    const dining = d0.budgets.find((b) => b.id === 'b-dining')!;
    let d = d0;
    d = addTransaction(d, expense(1_000, { at: '2026-09-30T23:59' }), ctx()).data; // previous month
    d = addTransaction(d, expense(1_000, { categoryId: 'groceries' }), ctx()).data; // other category
    d = addTransaction(d, { ...expense(1_000), type: 'income', categoryId: 'other-income' }, ctx()).data;
    d = addTransaction(d, { ...expense(1_000), type: 'transfer', categoryId: null, toAccountId: 'a-cash' }, ctx()).data;
    expect(budgetProgress(dining, d.transactions, '2026-10-26').spent).toBe(28_640);
    d = addTransaction(d, expense(1_000, { at: '2026-10-31T23:59' }), ctx()).data; // last minute of the month counts
    expect(budgetProgress(dining, d.transactions, '2026-10-26').spent).toBe(29_640);
  });

  it('periods roll over at month boundaries', () => {
    const b = { period: 'monthly' as const };
    expect(budgetPeriod(b, '2026-10-31')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(budgetPeriod(b, '2026-11-01')).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(budgetPeriod({ period: 'weekly' }, '2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    const dining = fresh().budgets[0];
    expect(budgetProgress(dining, fresh().transactions, '2026-11-02').spent).toBe(0);
  });

  it('remaining, near-limit and over-budget states', () => {
    const d = fresh();
    const health = d.budgets.find((b) => b.id === 'b-health')!; // $65 of $100, alert at 80%
    expect(budgetProgress(health, d.transactions, '2026-10-26')).toMatchObject({ remaining: 3_500, state: 'on-track' });
    const d2 = addTransaction(d, expense(1_500, { categoryId: 'health' }), ctx()).data;
    expect(budgetProgress(health, d2.transactions, '2026-10-26')).toMatchObject({ remaining: 2_000, state: 'near' });
    const d3 = addTransaction(d2, expense(2_001, { categoryId: 'health' }), ctx()).data;
    expect(budgetProgress(health, d3.transactions, '2026-10-26')).toMatchObject({ remaining: -1, state: 'over' });
    expect(d3.notifications.some((x) => x.key?.startsWith('budget:b-health') && x.key.endsWith(':over'))).toBe(true);
  });

  it('a group budget counts each expense once', () => {
    const d0 = fresh();
    const { data, budget } = addBudget({ ...d0, budgets: [] }, { name: 'Food', categoryIds: ['dining', 'groceries'], limit: 100_000, period: 'monthly', alertThreshold: 80 }, ctx());
    expect(budgetProgress(budget, data.transactions, '2026-10-26').spent).toBe(28_640 + 41_260);
  });

  it('validates new budgets and edits', () => {
    const d = fresh();
    expect(() => addBudget(d, { name: '', categoryIds: [], limit: 0, period: 'monthly', alertThreshold: 80 }, ctx())).toThrow(ValidationError);
    expect(() => addBudget(d, { name: 'Again', categoryIds: ['dining'], limit: 100, period: 'monthly', alertThreshold: 80 }, ctx())).toThrow(/already has a budget/);
    const d2 = updateBudget(d, 'b-dining', { name: 'Dining', categoryIds: ['dining'], limit: 30_000, period: 'monthly', alertThreshold: 80 }, ctx());
    expect(budgetProgress(d2.budgets[0], d2.transactions, '2026-10-26').state).toBe('near');
    expect(deleteBudget(d2, 'b-dining').budgets).toHaveLength(6);
  });
});

describe('reports', () => {
  it('totals, net cash flow and transfer exclusion', () => {
    const d = fresh();
    expect(periodTotals(d.transactions, oct, 'USD')).toMatchObject({ income: 635_000, expenses: 302_040, net: 332_960 });
  });

  it('category totals reconcile with total spending for any range', () => {
    const d = fresh();
    for (const range of [oct, { start: '2026-05-01', end: '2026-10-26' }, { start: '2026-10-15', end: '2026-10-21' }]) {
      const total = periodTotals(d.transactions, range, 'USD').expenses;
      expect(spendingByCategory(d.transactions, range, 'USD').reduce((s, c) => s + c.amount, 0)).toBe(total);
    }
  });

  it('date ranges are inclusive at both ends', () => {
    const d = fresh();
    expect(periodTotals(d.transactions, { start: '2026-10-26', end: '2026-10-26' }, 'USD').expenses).toBe(1_275);
    expect(periodTotals(d.transactions, { start: '2026-10-01', end: '2026-10-01' }, 'USD')).toMatchObject({ income: 520_000, expenses: 165_000 });
  });
});

describe('savings goals', () => {
  it('contributions update progress and the goal account, without counting as spending', () => {
    const d0 = fresh();
    const goal = d0.goals[0];
    const { data: d1 } = addContribution(d0, goal.id, { amount: 60_000, fromAccountId: 'a-checking', at: '2026-10-26T10:00', note: '' }, ctx());
    const p = goalProgress(goal, d1.transactions, '2026-10-26');
    expect(p.saved).toBe(1_020_000);
    expect(p.remaining).toBe(480_000);
    expect(Math.round(p.progress * 100)).toBe(68);
    expect(bal(d1, 'a-savings')).toBe(bal(d0, 'a-savings') + 60_000);
    expect(periodTotals(d1.transactions, oct, 'USD')).toEqual(periodTotals(d0.transactions, oct, 'USD'));
    expect(netWorth(d1)[0].net).toBe(netWorth(d0)[0].net);
  });

  it('rejects invalid or excessive contributions', () => {
    const d = fresh();
    const goal = d.goals[0];
    const add = (amount: number, from = 'a-checking') => addContribution(d, goal.id, { amount, fromAccountId: from, at: '2026-10-26T10:00', note: '' }, ctx());
    expect(() => add(0)).toThrow(/greater than zero/);
    expect(() => add(540_001)).toThrow(/more than this goal still needs/);
    expect(() => add(100, 'a-savings')).toThrow(/different account/);
  });

  it('completes a goal at 100% and notifies once', () => {
    const d0 = fresh();
    const { data: d1, goal } = addGoal(d0, { name: 'Bike', icon: 'bike', target: 50_000, targetDate: '2027-03-01', monthlyPlan: 10_000, accountId: 'a-savings' }, ctx());
    const { data: d2 } = addContribution(d1, goal.id, { amount: 50_000, fromAccountId: 'a-checking', at: '2026-10-26T10:00', note: '' }, ctx());
    expect(d2.goals.find((g) => g.id === goal.id)!.status).toBe('completed');
    expect(d2.notifications.filter((x) => x.key === `goal:${goal.id}:100`)).toHaveLength(1);
    expect(() => addContribution(d2, goal.id, { amount: 1, fromAccountId: 'a-checking', at: '2026-10-26T10:00', note: '' }, ctx())).toThrow(/already complete/);
  });

  it('deleting a goal keeps the money and stops attributing it', () => {
    const d = deleteGoal(fresh(), 'g-emergency');
    expect(bal(d, 'a-savings')).toBe(1_230_000);
    expect(d.transactions.some((t) => t.goalId === 'g-emergency')).toBe(false);
  });
});

describe('notifications', () => {
  it('mark all read', () => {
    expect(markAllRead(fresh()).notifications.every((x) => x.read)).toBe(true);
  });
});

describe('notification dedupe', () => {
  it('does not repeat a seeded budget alert when another expense lands in the same month', () => {
    let n = 0;
    const ctx = { stamp: '2026-10-26T00:00:00.000Z', now: '2026-10-26T09:00', id: () => `t-${++n}` };
    const res = addTransaction(buildSeed(), { type: 'expense', amount: 500, description: 'Cafe', categoryId: 'dining', accountId: 'a-checking', toAccountId: null, at: '2026-10-26T09:00', note: '' }, ctx);
    expect(res.data.notifications.filter((x) => x.title === 'Dining budget exceeded')).toHaveLength(1);
  });
});
