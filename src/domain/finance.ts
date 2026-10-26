/**
 * The single financial calculation layer. Screens never compute totals themselves.
 *
 * Definitions
 * - Account balance = opening balance + income into it − expenses from it
 *   − transfers out of it + transfers into it.
 * - Net balance = Σ account balances, per currency (never mixed across currencies).
 * - Income / expenses for a period = Σ income / expense transactions dated in it.
 *   Transfers (including savings contributions) are never income or spending.
 * - Net cash flow = income − expenses.
 * - Budget spent = Σ expenses in the budget's current period whose category is in
 *   the budget; each transaction counts once.
 * - Goal saved = Σ contribution transfers carrying that goal's id.
 */
import { addDays, daysBetween, inRange, monthOf, monthRange, monthsInRange, type DateRange, type LocalDate, type Month } from './dates';
import type { Cents, CurrencyCode } from './money';
import type { Account, Budget, MontraData, SavingsGoal, Transaction } from './types';

export function accountDelta(t: Transaction, accountId: string): Cents {
  if (t.type === 'income') return t.accountId === accountId ? t.amount : 0;
  if (t.type === 'expense') return t.accountId === accountId ? -t.amount : 0;
  let d = 0;
  if (t.accountId === accountId) d -= t.amount;
  if (t.toAccountId === accountId) d += t.amount;
  return d;
}

export function accountBalance(account: Account, txns: Transaction[], asOf?: LocalDate): Cents {
  let bal = account.openingBalance;
  for (const t of txns) {
    if (asOf && t.at.slice(0, 10) > asOf) continue;
    bal += accountDelta(t, account.id);
  }
  return bal;
}

export function balances(data: Pick<MontraData, 'accounts' | 'transactions'>): Map<string, Cents> {
  const out = new Map(data.accounts.map((a) => [a.id, a.openingBalance]));
  for (const t of data.transactions) {
    if (t.type === 'income') out.set(t.accountId, (out.get(t.accountId) ?? 0) + t.amount);
    else if (t.type === 'expense') out.set(t.accountId, (out.get(t.accountId) ?? 0) - t.amount);
    else {
      out.set(t.accountId, (out.get(t.accountId) ?? 0) - t.amount);
      if (t.toAccountId) out.set(t.toAccountId, (out.get(t.toAccountId) ?? 0) + t.amount);
    }
  }
  return out;
}

export interface NetWorth {
  currency: CurrencyCode;
  net: Cents;
  assets: Cents;
  owed: Cents;
  accounts: number;
}

/** Net balance grouped by currency. Assets = positive balances; owed = negative balances. */
export function netWorth(data: Pick<MontraData, 'accounts' | 'transactions'>): NetWorth[] {
  const bal = balances(data);
  const by = new Map<CurrencyCode, NetWorth>();
  for (const a of data.accounts) {
    const b = bal.get(a.id) ?? 0;
    const row = by.get(a.currency) ?? { currency: a.currency, net: 0, assets: 0, owed: 0, accounts: 0 };
    row.net += b;
    if (b >= 0) row.assets += b;
    else row.owed += b;
    row.accounts += 1;
    by.set(a.currency, row);
  }
  return [...by.values()].sort((x, y) => y.accounts - x.accounts);
}

export interface PeriodTotals {
  income: Cents;
  expenses: Cents;
  net: Cents;
  count: number;
}

/** Income and expenses in a currency over a range. Transfers excluded. */
export function periodTotals(txns: Transaction[], range: DateRange, currency: CurrencyCode): PeriodTotals {
  let income = 0;
  let expenses = 0;
  let count = 0;
  for (const t of txns) {
    if (t.currency !== currency || t.type === 'transfer' || !inRange(t.at, range)) continue;
    if (t.type === 'income') income += t.amount;
    else expenses += t.amount;
    count += 1;
  }
  return { income, expenses, net: income - expenses, count };
}

export interface CategoryTotal {
  categoryId: string;
  amount: Cents;
  share: number;
  count: number;
}

/** Expenses by category for a range; shares are fractions of the same expense total. */
export function spendingByCategory(txns: Transaction[], range: DateRange, currency: CurrencyCode): CategoryTotal[] {
  const by = new Map<string, { amount: Cents; count: number }>();
  let total = 0;
  for (const t of txns) {
    if (t.type !== 'expense' || t.currency !== currency || !inRange(t.at, range)) continue;
    const key = t.categoryId ?? 'uncategorized';
    const row = by.get(key) ?? { amount: 0, count: 0 };
    row.amount += t.amount;
    row.count += 1;
    by.set(key, row);
    total += t.amount;
  }
  return [...by.entries()]
    .map(([categoryId, r]) => ({ categoryId, amount: r.amount, count: r.count, share: total ? r.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount || a.categoryId.localeCompare(b.categoryId));
}

/** Monthly income/expense series for charts. */
export function monthlySeries(txns: Transaction[], range: DateRange, currency: CurrencyCode): { month: Month; income: Cents; expenses: Cents }[] {
  return monthsInRange(range).map((month) => {
    const r = monthRange(month);
    const clipped = { start: r.start < range.start ? range.start : r.start, end: r.end > range.end ? range.end : r.end };
    const t = periodTotals(txns, clipped, currency);
    return { month, income: t.income, expenses: t.expenses };
  });
}

/** Percentage change, one decimal; null when there is nothing to compare with. */
export function change(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/* ───────────── Budgets ───────────── */

/** The budget period containing `today`: calendar month, or Monday-start week. */
export function budgetPeriod(budget: Pick<Budget, 'period'>, today: LocalDate): DateRange {
  if (budget.period === 'monthly') return monthRange(monthOf(today));
  const [y, m, d] = today.split('-').map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const start = addDays(today, -weekday);
  return { start, end: addDays(start, 6) };
}

export type BudgetState = 'on-track' | 'near' | 'over';

export interface BudgetProgress {
  spent: Cents;
  limit: Cents;
  remaining: Cents;
  used: number;
  state: BudgetState;
  period: DateRange;
  daysLeft: number;
  transactions: Transaction[];
}

export function budgetProgress(budget: Budget, txns: Transaction[], today: LocalDate, period = budgetPeriod(budget, today)): BudgetProgress {
  const cats = new Set(budget.categoryIds);
  const matched = txns.filter((t) => t.type === 'expense' && t.currency === budget.currency && t.categoryId !== null && cats.has(t.categoryId) && inRange(t.at, period));
  const spent = matched.reduce((s, t) => s + t.amount, 0);
  const used = budget.limit ? (spent / budget.limit) * 100 : 0;
  const state: BudgetState = spent > budget.limit ? 'over' : used >= budget.alertThreshold ? 'near' : 'on-track';
  return {
    spent,
    limit: budget.limit,
    remaining: budget.limit - spent,
    used,
    state,
    period,
    daysLeft: Math.max(0, daysBetween(today, period.end)),
    transactions: [...matched].sort((a, b) => b.at.localeCompare(a.at)),
  };
}

export interface BudgetSummary {
  spent: Cents;
  limit: Cents;
  remaining: Cents;
  used: number;
  perDayLeft: Cents;
  daysLeft: number;
}

/**
 * Totals across monthly budgets. Each expense counts once even when budgets overlap.
 * Per-day-left divides what remains by the days after today in the month.
 */
export function budgetSummary(budgets: Budget[], txns: Transaction[], today: LocalDate, currency: CurrencyCode): BudgetSummary {
  const monthly = budgets.filter((b) => b.period === 'monthly' && b.currency === currency);
  const period = monthRange(monthOf(today));
  const cats = new Set(monthly.flatMap((b) => b.categoryIds));
  const spent = txns
    .filter((t) => t.type === 'expense' && t.currency === currency && t.categoryId !== null && cats.has(t.categoryId) && inRange(t.at, period))
    .reduce((s, t) => s + t.amount, 0);
  const limit = monthly.reduce((s, b) => s + b.limit, 0);
  const daysLeft = Math.max(0, daysBetween(today, period.end));
  const remaining = limit - spent;
  return { spent, limit, remaining, used: limit ? (spent / limit) * 100 : 0, perDayLeft: daysLeft && remaining > 0 ? Math.floor(remaining / daysLeft) : 0, daysLeft };
}

/** Spending per week (Mon–Sun, clipped to the period) for a budget. */
export function weeklySpending(budget: Budget, txns: Transaction[], period: DateRange): { range: DateRange; amount: Cents }[] {
  const cats = new Set(budget.categoryIds);
  const weeks: { range: DateRange; amount: Cents }[] = [];
  let start = period.start;
  while (start <= period.end) {
    const end = addDays(start, 6) > period.end ? period.end : addDays(start, 6);
    weeks.push({ range: { start, end }, amount: 0 });
    start = addDays(end, 1);
  }
  for (const t of txns) {
    if (t.type !== 'expense' || t.currency !== budget.currency || !t.categoryId || !cats.has(t.categoryId)) continue;
    const w = weeks.find((x) => inRange(t.at, x.range));
    if (w) w.amount += t.amount;
  }
  return weeks;
}

/* ───────────── Savings ───────────── */

export interface GoalProgress {
  saved: Cents;
  remaining: Cents;
  progress: number;
  contributions: Transaction[];
  complete: boolean;
  /** Month the plan reaches the target, if a monthly plan is set. */
  projected: Month | null;
}

export function goalProgress(goal: SavingsGoal, txns: Transaction[], today: LocalDate): GoalProgress {
  const contributions = txns.filter((t) => t.goalId === goal.id && t.type === 'transfer').sort((a, b) => b.at.localeCompare(a.at));
  const saved = contributions.reduce((s, t) => s + t.amount, 0);
  const remaining = Math.max(0, goal.target - saved);
  const months = goal.monthlyPlan > 0 ? Math.ceil(remaining / goal.monthlyPlan) : null;
  const [y, m] = monthOf(today).split('-').map(Number);
  const projected = months === null ? null : (() => {
    const idx = y * 12 + (m - 1) + months;
    return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
  })();
  return { saved, remaining, progress: goal.target ? Math.min(1, saved / goal.target) : 0, contributions, complete: saved >= goal.target, projected };
}

/** Amount still allowed for a contribution without exceeding the target. */
export function maxContribution(goal: SavingsGoal, txns: Transaction[], today: LocalDate): Cents {
  return goalProgress(goal, txns, today).remaining;
}
