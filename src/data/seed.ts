/**
 * Deterministic sample data ("Ziah Makmur", USD) reconstructed from the Figma
 * screens. October 2026 uses the exact transactions and per-category totals
 * shown in the design; earlier months are generated so the six-month chart
 * and the "vs Sep" comparisons have data. Opening balances are derived so
 * that current balances equal the design's account balances.
 *
 * Nothing here is a hardcoded summary: every total on screen is computed from
 * these transactions by src/domain/finance.ts.
 */
import { accountDelta } from '@/domain/finance';
import type { Account, AppNotification, Budget, MontraData, SavingsGoal, Transaction, TransactionType } from '@/domain/types';

export const DATA_VERSION = 1;
const STAMP = '2026-10-26T08:00:00.000Z';

type Seed = [at: string, type: TransactionType, amount: number, description: string, categoryId: string | null, accountId: string, extra?: Partial<Transaction>];

let seq = 0;
function tx([at, type, amount, description, categoryId, accountId, extra]: Seed): Transaction {
  seq += 1;
  return {
    id: `t-${String(seq).padStart(4, '0')}`,
    type,
    amount: Math.round(amount * 100),
    currency: 'USD',
    description,
    categoryId,
    accountId,
    toAccountId: null,
    goalId: null,
    at,
    note: '',
    tags: [],
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  };
}

const CHK = 'a-checking';
const SAV = 'a-savings';
const CASH = 'a-cash';
const CARD = 'a-card';

/** October 2026 — matches the design to the cent (expenses $3,020.40, income $6,350.00). */
const OCTOBER: Seed[] = [
  ['2026-10-01T09:00', 'income', 5200, 'Salary — Northwind Studio', 'salary', CHK],
  ['2026-10-01T09:15', 'expense', 1650, 'Rent — Maple Court', 'housing', CHK],
  ['2026-10-03T19:20', 'expense', 21.5, 'Tartine Bakery', 'dining', CARD],
  ['2026-10-04T11:05', 'expense', 148.35, 'Costco', 'groceries', CARD],
  ['2026-10-05T10:00', 'expense', 42.5, 'Verizon', 'bills', CARD],
  ['2026-10-05T13:10', 'expense', 11.99, 'Spotify', 'subscriptions', CARD],
  ['2026-10-06T07:55', 'expense', 48.6, 'Shell', 'transport', CARD],
  ['2026-10-06T12:40', 'expense', 24.5, 'Chipotle', 'dining', CARD],
  ['2026-10-08T20:00', 'expense', 15.49, 'Netflix', 'subscriptions', CARD],
  ['2026-10-09T15:30', 'expense', 125.09, 'Amazon', 'shopping', CARD],
  ['2026-10-10T19:45', 'expense', 78, 'Gjelina', 'dining', CARD],
  ['2026-10-11T10:20', 'expense', 58.9, 'Whole Foods Market', 'groceries', CARD],
  ['2026-10-12T22:10', 'expense', 23.4, 'Uber', 'transport', CARD],
  ['2026-10-13T08:00', 'expense', 70, 'Sonic Fiber Internet', 'bills', CARD],
  ['2026-10-13T13:15', 'expense', 24.85, 'Shake Shack', 'dining', CARD],
  ['2026-10-14T09:00', 'expense', 2.99, 'iCloud+', 'subscriptions', CARD],
  ['2026-10-15T18:30', 'expense', 54.7, "Trader Joe's", 'groceries', CARD],
  ['2026-10-16T09:00', 'expense', 86.25, 'PG&E', 'bills', CARD],
  ['2026-10-17T17:40', 'expense', 65, 'CVS Pharmacy', 'health', CARD],
  ['2026-10-18T10:00', 'income', 1150, 'Freelance — Lumen Labs', 'freelance', CHK],
  ['2026-10-19T20:35', 'expense', 96.4, 'Osteria Mozza', 'dining', CARD, { note: 'Dinner with Ana' }],
  ['2026-10-20T08:10', 'expense', 52.8, 'Shell', 'transport', CARD],
  ['2026-10-21T08:20', 'expense', 9.5, 'Blue Bottle Coffee', 'dining', CHK],
  ['2026-10-21T17:52', 'expense', 64.2, "Trader Joe's", 'groceries', CHK],
  ['2026-10-21T21:00', 'expense', 13.99, 'YouTube Premium', 'subscriptions', CARD],
  ['2026-10-22T16:30', 'expense', 89.9, 'Uniqlo', 'shopping', CARD],
  ['2026-10-24T12:48', 'expense', 18.9, 'Sweetgreen', 'dining', CARD],
  ['2026-10-25T18:15', 'expense', 86.45, 'Whole Foods Market', 'groceries', CHK],
  ['2026-10-25T21:05', 'expense', 23.4, 'Uber', 'transport', CARD],
  ['2026-10-26T08:42', 'expense', 12.75, 'Blue Bottle Coffee', 'dining', CHK, { note: 'Oat latte before standup' }],
  // Not spending: paying down the card moves money between accounts.
  ['2026-10-03T09:30', 'transfer', 517.6, 'Credit card payment', null, CHK, { toAccountId: CARD }],
];

/** Per-category spending for earlier months (Sep reconciles to $3,104.00 for the "↓ 2.7%" comparison). */
const HISTORY: Record<string, { income: [string, number, string][]; spend: Record<string, number> }> = {
  '2026-01': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 398.2, dining: 212.4, transport: 131.75, shopping: 96.3, bills: 231.6, subscriptions: 44.46, health: 0 } },
  '2026-02': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 376.9, dining: 198.65, transport: 118.4, shopping: 142.1, bills: 224.3, subscriptions: 44.46, health: 35 } },
  '2026-03': { income: [['Salary — Northwind Studio', 5200, 'salary'], ['Freelance — Lumen Labs', 800, 'freelance']], spend: { housing: 1650, groceries: 405.15, dining: 254.8, transport: 140.25, shopping: 210.6, bills: 205.9, subscriptions: 44.46, health: 0 } },
  '2026-04': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 389.6, dining: 231.35, transport: 152.9, shopping: 120.45, bills: 196.4, subscriptions: 44.46, health: 80 } },
  '2026-05': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 410.3, dining: 262.15, transport: 146.8, shopping: 175.2, bills: 199.85, subscriptions: 44.46, health: 0 } },
  '2026-06': { income: [['Salary — Northwind Studio', 5200, 'salary'], ['Freelance — Lumen Labs', 650, 'freelance']], spend: { housing: 1650, groceries: 422.75, dining: 228.4, transport: 158.6, shopping: 240.3, bills: 188.2, subscriptions: 44.46, health: 55 } },
  '2026-07': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 401.9, dining: 240.0, transport: 149.35, shopping: 118.9, bills: 210.45, subscriptions: 44.46, health: 0 } },
  '2026-08': { income: [['Salary — Northwind Studio', 5200, 'salary'], ['Freelance — Lumen Labs', 400, 'freelance']], spend: { housing: 1650, groceries: 438.1, dining: 300.0, transport: 171.25, shopping: 205.75, bills: 215.3, subscriptions: 44.46, health: 0 } },
  '2026-09': { income: [['Salary — Northwind Studio', 5200, 'salary']], spend: { housing: 1650, groceries: 430.0, dining: 360.0, transport: 162.5, shopping: 188.04, bills: 202.0, subscriptions: 44.46, health: 67.0 } },
};

const MERCHANTS: Record<string, [string, string][]> = {
  housing: [['Rent — Maple Court', CHK]],
  groceries: [['Whole Foods Market', CHK], ["Trader Joe's", CHK], ['Costco', CARD]],
  dining: [['Blue Bottle Coffee', CHK], ['Sweetgreen', CARD], ['Shake Shack', CARD], ['Tartine Bakery', CARD]],
  transport: [['Shell', CARD], ['Uber', CARD]],
  shopping: [['Amazon', CARD], ['Uniqlo', CARD]],
  bills: [['PG&E', CARD], ['Sonic Fiber Internet', CARD], ['Verizon', CARD]],
  subscriptions: [['Spotify', CARD], ['Netflix', CARD], ['iCloud+', CARD], ['YouTube Premium', CARD]],
  health: [['CVS Pharmacy', CARD]],
};
const SUBS = [11.99, 15.49, 2.99, 13.99];

/** Splits a monthly category total into dated transactions whose cents add up exactly. */
function monthSeeds(month: string): Seed[] {
  const h = HISTORY[month];
  const out: Seed[] = [];
  h.income.forEach(([d, a, c], i) => out.push([`${month}-${i === 0 ? '01' : '18'}T${i === 0 ? '09:00' : '10:00'}`, 'income', a, d, c, CHK]));
  for (const [cat, total] of Object.entries(h.spend)) {
    if (!total) continue;
    const merchants = MERCHANTS[cat];
    if (cat === 'subscriptions') {
      SUBS.forEach((a, i) => out.push([`${month}-${String(5 + i * 5).padStart(2, '0')}T09:00`, 'expense', a, merchants[i][0], cat, merchants[i][1]]));
      continue;
    }
    const parts = cat === 'housing' ? 1 : cat === 'health' ? 1 : cat === 'groceries' || cat === 'dining' ? 4 : cat === 'bills' ? 3 : 2;
    const cents = Math.round(total * 100);
    const weights = [0.31, 0.24, 0.27, 0.18].slice(0, parts);
    const wsum = weights.reduce((a, b) => a + b, 0);
    let used = 0;
    for (let i = 0; i < parts; i++) {
      const c = i === parts - 1 ? cents - used : Math.round((cents * weights[i]) / wsum);
      used += c;
      const [name, acct] = merchants[i % merchants.length];
      const day = cat === 'housing' ? 1 : 3 + i * 7 + (cat.length % 3);
      out.push([`${month}-${String(day).padStart(2, '0')}T${String(10 + i * 2).padStart(2, '0')}:${String((cat.length * 7) % 60).padStart(2, '0')}`, 'expense', c / 100, name, cat, acct]);
    }
  }
  // Monthly card payment from checking (a transfer, not spending).
  out.push([`${month}-03T09:30`, 'transfer', 650, 'Credit card payment', null, CHK, { toAccountId: CARD }]);
  return out;
}

const GOALS: SavingsGoal[] = [
  { id: 'g-emergency', name: 'Emergency Fund', icon: 'shield', target: 1_500_000, currency: 'USD', targetDate: '2027-06-30', accountId: SAV, monthlyPlan: 60_000, status: 'active', createdAt: '2025-07-01T09:00:00.000Z', updatedAt: STAMP },
  { id: 'g-laptop', name: 'New Laptop', icon: 'laptop', target: 240_000, currency: 'USD', targetDate: '2027-02-28', accountId: SAV, monthlyPlan: 13_000, status: 'active', createdAt: '2025-09-01T09:00:00.000Z', updatedAt: STAMP },
  { id: 'g-japan', name: 'Japan Trip', icon: 'plane', target: 450_000, currency: 'USD', targetDate: '2027-10-31', accountId: SAV, monthlyPlan: 19_000, status: 'active', createdAt: '2026-04-01T09:00:00.000Z', updatedAt: STAMP },
];

/** Contribution transfers into the savings account; they sum to $9,600, $1,560 and $1,140. */
function contributionSeeds(): Seed[] {
  const out: Seed[] = [];
  const months = (from: string, n: number) => Array.from({ length: n }, (_, i) => {
    const [y, m] = from.split('-').map(Number);
    const idx = y * 12 + (m - 1) + i;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  });
  for (const m of months('2025-07', 16)) out.push([`${m}-02T09:00`, 'transfer', 600, 'Monthly contribution', null, CHK, { toAccountId: SAV, goalId: 'g-emergency' }]);
  for (const m of months('2025-09', 12)) out.push([`${m}-15T09:00`, 'transfer', 130, 'Monthly contribution', null, CHK, { toAccountId: SAV, goalId: 'g-laptop' }]);
  for (const m of months('2026-04', 6)) out.push([`${m}-20T09:00`, 'transfer', 190, 'Monthly contribution', null, CHK, { toAccountId: SAV, goalId: 'g-japan' }]);
  return out;
}

const TARGET_BALANCES: Record<string, number> = { [CHK]: 842_050, [SAV]: 1_230_000, [CASH]: 28_600, [CARD]: -124_830 };

function baseAccounts(): Account[] {
  const a = (id: string, name: string, type: Account['type'], mask: string, dueDate: string | null = null): Account => ({
    id,
    name,
    type,
    currency: 'USD',
    openingBalance: 0,
    openingDate: '2025-07-01',
    mask,
    dueDate,
    createdAt: '2025-07-01T09:00:00.000Z',
    updatedAt: STAMP,
  });
  return [a(CHK, 'Everyday Checking', 'checking', '2048'), a(SAV, 'Savings Account', 'savings', '7310'), a(CASH, 'Cash Wallet', 'cash', ''), a(CARD, 'Credit Card', 'credit', '4021', '2026-11-12')];
}

const BUDGETS: [string, string, number][] = [
  ['b-dining', 'dining', 250],
  ['b-groceries', 'groceries', 500],
  ['b-bills', 'bills', 260],
  ['b-transport', 'transport', 200],
  ['b-subscriptions', 'subscriptions', 60],
  ['b-shopping', 'shopping', 300],
  ['b-health', 'health', 100],
];

const NOTIFICATIONS: Omit<AppNotification, 'id'>[] = [
  { type: 'budget', title: 'Dining budget exceeded', message: 'You’ve spent $286.40 of your $250.00 Dining budget for October.', createdAt: '2026-10-26T08:43', read: false, ref: { kind: 'budget', id: 'b-dining' }, key: 'budget:b-dining:2026-10-01:over' },
  { type: 'transaction', title: 'Expense added', message: 'Blue Bottle Coffee · −$12.75 · Everyday Checking', createdAt: '2026-10-26T08:42', read: true, ref: null, key: null },
  { type: 'budget', title: 'Groceries at 83% of budget', message: '$87.40 left for the last 5 days of October.', createdAt: '2026-10-25T18:16', read: true, ref: { kind: 'budget', id: 'b-groceries' }, key: 'budget:b-groceries:2026-10-01:near' },
  { type: 'bill', title: 'Credit card payment due Nov 12', message: 'Statement balance $1,248.30. Pay before the due date to avoid fees.', createdAt: '2026-10-24T09:00', read: true, ref: { kind: 'account', id: CARD }, key: null },
  { type: 'bill', title: 'Internet bill coming up', message: 'Sonic Fiber Internet · $70.00 · due Nov 13', createdAt: '2026-10-22T09:00', read: true, ref: null, key: null },
  { type: 'goal', title: 'Emergency Fund passed 60%', message: '$9,600 of $15,000 saved — keep going.', createdAt: '2026-10-02T09:01', read: true, ref: { kind: 'goal', id: 'g-emergency' }, key: 'goal:g-emergency:60' },
];

export function buildSeed(): MontraData {
  seq = 0;
  const seeds: Seed[] = [...contributionSeeds(), ...Object.keys(HISTORY).flatMap(monthSeeds), ...OCTOBER];
  const transactions = seeds.map(tx);
  const accounts = baseAccounts().map((a) => {
    const flow = transactions.reduce((s, t) => s + accountDelta(t, a.id), 0);
    return { ...a, openingBalance: TARGET_BALANCES[a.id] - flow };
  });
  return {
    version: DATA_VERSION,
    accounts,
    transactions,
    budgets: BUDGETS.map(([id, cat, limit]) => ({
      id,
      name: cat[0].toUpperCase() + cat.slice(1),
      categoryIds: [cat],
      limit: limit * 100,
      currency: 'USD',
      period: 'monthly',
      alertThreshold: 80,
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: STAMP,
    })) satisfies Budget[],
    goals: GOALS,
    notifications: NOTIFICATIONS.map((n, i) => ({ ...n, id: `n-${i + 1}` })),
    settings: { name: 'Ziah Makmur', email: 'ziah.makmur@example.com', defaultCurrency: 'USD', dateStyle: 'us', budgetAlerts: true, theme: 'light', onboarded: false },
  };
}
