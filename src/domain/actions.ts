/**
 * Pure state transitions. Each action takes the current data and returns new
 * data (never mutating), so the store can persist the result and tests can
 * check the financial rules without a browser.
 *
 * Stored records hold only facts (transactions, limits, targets). Balances,
 * budget spending and goal progress are always derived in finance.ts, so an
 * edit replaces a transaction's effect and a delete removes it — nothing is
 * ever applied twice.
 */
import { budgetProgress, goalProgress } from './finance';
import { formatMoney } from './money';
import type { Account, AppNotification, Budget, ID, MontraData, SavingsGoal, Settings, Transaction } from './types';
import { hasErrors, validateAccount, validateBudget, validateContribution, validateGoal, validateTransaction, type Errors, type TransactionInput } from './validation';

export class ValidationError extends Error {
  constructor(public errors: Errors) {
    super(Object.values(errors).find(Boolean) ?? 'Invalid input');
    this.name = 'ValidationError';
  }
}

export interface Ctx {
  /** ISO timestamp for createdAt/updatedAt. */
  stamp: string;
  /** Local "now", e.g. 2026-10-26T08:42 (used for notifications and budget periods). */
  now: string;
  id: () => ID;
}

function notify(data: MontraData, ctx: Ctx, n: Omit<AppNotification, 'id' | 'createdAt' | 'read'>): MontraData {
  if (n.key && data.notifications.some((x) => x.key === n.key)) return data;
  return { ...data, notifications: [{ ...n, id: ctx.id(), createdAt: ctx.now, read: false }, ...data.notifications] };
}

/** Budget alerts for the month a changed expense lands in (deduplicated by key). */
function budgetAlerts(data: MontraData, ctx: Ctx, t: Transaction): MontraData {
  if (!data.settings.budgetAlerts || t.type !== 'expense' || !t.categoryId) return data;
  let next = data;
  for (const b of data.budgets.filter((x) => x.categoryIds.includes(t.categoryId!) && x.currency === t.currency)) {
    const p = budgetProgress(b, next.transactions, t.at.slice(0, 10));
    const month = p.period.start.slice(0, 7);
    if (p.state === 'over') {
      next = notify(next, ctx, {
        type: 'budget',
        title: `${b.name} budget exceeded`,
        message: `You’ve spent ${formatMoney(p.spent, b.currency)} of your ${formatMoney(b.limit, b.currency)} ${b.name} budget.`,
        ref: { kind: 'budget', id: b.id },
        key: `budget:${b.id}:${p.period.start}:over`,
      });
    } else if (p.state === 'near') {
      next = notify(next, ctx, {
        type: 'budget',
        title: `${b.name} at ${Math.round(p.used)}% of budget`,
        message: `${formatMoney(p.remaining, b.currency)} left for ${month === ctx.now.slice(0, 7) ? 'this period' : 'that period'}.`,
        ref: { kind: 'budget', id: b.id },
        key: `budget:${b.id}:${p.period.start}:near`,
      });
    }
  }
  return next;
}

export function addTransaction(data: MontraData, input: TransactionInput, ctx: Ctx): { data: MontraData; transaction: Transaction } {
  const errors = validateTransaction(input, data);
  if (hasErrors(errors)) throw new ValidationError(errors);
  const account = data.accounts.find((a) => a.id === input.accountId)!;
  const t: Transaction = {
    id: ctx.id(),
    type: input.type,
    amount: input.amount,
    currency: account.currency,
    description: input.description.trim() || (input.type === 'transfer' ? 'Transfer' : ''),
    categoryId: input.type === 'transfer' ? null : input.categoryId,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    goalId: input.type === 'transfer' ? (input.goalId ?? null) : null,
    at: input.at,
    note: input.note.trim(),
    tags: [],
    createdAt: ctx.stamp,
    updatedAt: ctx.stamp,
  };
  let next: MontraData = { ...data, transactions: [...data.transactions, t] };
  if (t.type !== 'transfer') {
    next = notify(next, ctx, {
      type: 'transaction',
      title: t.type === 'expense' ? 'Expense added' : 'Income added',
      message: `${t.description} · ${formatMoney(t.type === 'expense' ? -t.amount : t.amount, t.currency, { sign: 'always' })} · ${account.name}`,
      ref: { kind: 'transaction', id: t.id },
      key: null,
    });
  }
  next = budgetAlerts(next, ctx, t);
  return { data: next, transaction: t };
}

export function updateTransaction(data: MontraData, id: ID, input: TransactionInput, ctx: Ctx): { data: MontraData; transaction: Transaction } {
  const prev = data.transactions.find((t) => t.id === id);
  if (!prev) throw new ValidationError({ form: 'This transaction no longer exists' });
  const errors = validateTransaction(input, data);
  if (hasErrors(errors)) throw new ValidationError(errors);
  const account = data.accounts.find((a) => a.id === input.accountId)!;
  const t: Transaction = {
    ...prev,
    type: input.type,
    amount: input.amount,
    currency: account.currency,
    description: input.description.trim() || prev.description,
    categoryId: input.type === 'transfer' ? null : input.categoryId,
    accountId: input.accountId,
    toAccountId: input.type === 'transfer' ? input.toAccountId : null,
    goalId: input.type === 'transfer' ? (input.goalId ?? prev.goalId) : null,
    at: input.at,
    note: input.note.trim(),
    updatedAt: ctx.stamp,
  };
  const next = { ...data, transactions: data.transactions.map((x) => (x.id === id ? t : x)) };
  return { data: budgetAlerts(next, ctx, t), transaction: t };
}

export function deleteTransaction(data: MontraData, id: ID): { data: MontraData; removed: Transaction } {
  const removed = data.transactions.find((t) => t.id === id);
  if (!removed) throw new ValidationError({ form: 'This transaction no longer exists' });
  return {
    data: {
      ...data,
      transactions: data.transactions.filter((t) => t.id !== id),
      notifications: data.notifications.map((n) => (n.ref?.kind === 'transaction' && n.ref.id === id ? { ...n, ref: null } : n)),
    },
    removed,
  };
}

/** Puts a deleted transaction back exactly as it was (Undo). */
export function restoreTransaction(data: MontraData, t: Transaction): MontraData {
  if (data.transactions.some((x) => x.id === t.id)) return data;
  return { ...data, transactions: [...data.transactions, t] };
}

/* ───────────── Accounts ───────────── */

export function addAccount(data: MontraData, input: Pick<Account, 'name' | 'type' | 'currency' | 'openingBalance' | 'mask'>, ctx: Ctx): { data: MontraData; account: Account } {
  const errors = validateAccount(input);
  if (hasErrors(errors)) throw new ValidationError(errors);
  const account: Account = { ...input, name: input.name.trim(), mask: input.mask.replace(/\D/g, '').slice(-4), id: ctx.id(), openingDate: ctx.now.slice(0, 10), dueDate: null, createdAt: ctx.stamp, updatedAt: ctx.stamp };
  return { data: { ...data, accounts: [...data.accounts, account] }, account };
}

/**
 * Sets an account's current balance by adjusting its opening balance, so the
 * correction doesn't appear as income or spending in reports.
 */
export function setAccountBalance(data: MontraData, id: ID, current: number, currentComputed: number, ctx: Ctx): MontraData {
  return { ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, openingBalance: a.openingBalance + (current - currentComputed), updatedAt: ctx.stamp } : a)) };
}

export function renameAccount(data: MontraData, id: ID, name: string, ctx: Ctx): MontraData {
  const errors = validateAccount({ name, type: 'checking', openingBalance: 0 });
  if (errors.name) throw new ValidationError({ name: errors.name });
  return { ...data, accounts: data.accounts.map((a) => (a.id === id ? { ...a, name: name.trim(), updatedAt: ctx.stamp } : a)) };
}

export function deleteAccount(data: MontraData, id: ID): MontraData {
  if (data.transactions.some((t) => t.accountId === id || t.toAccountId === id)) throw new ValidationError({ form: 'Accounts with transactions can’t be deleted' });
  if (data.goals.some((g) => g.accountId === id)) throw new ValidationError({ form: 'A savings goal uses this account' });
  return { ...data, accounts: data.accounts.filter((a) => a.id !== id) };
}

/* ───────────── Budgets ───────────── */

export type BudgetInput = Pick<Budget, 'name' | 'categoryIds' | 'limit' | 'period' | 'alertThreshold'>;

export function addBudget(data: MontraData, input: BudgetInput, ctx: Ctx): { data: MontraData; budget: Budget } {
  const errors = validateBudget(input, data.budgets);
  if (hasErrors(errors)) throw new ValidationError(errors);
  const budget: Budget = { ...input, name: input.name.trim(), id: ctx.id(), currency: data.settings.defaultCurrency, createdAt: ctx.stamp, updatedAt: ctx.stamp };
  return { data: { ...data, budgets: [...data.budgets, budget] }, budget };
}

export function updateBudget(data: MontraData, id: ID, input: BudgetInput, ctx: Ctx): MontraData {
  const errors = validateBudget(input, data.budgets, id);
  if (hasErrors(errors)) throw new ValidationError(errors);
  return { ...data, budgets: data.budgets.map((b) => (b.id === id ? { ...b, ...input, name: input.name.trim(), updatedAt: ctx.stamp } : b)) };
}

export function deleteBudget(data: MontraData, id: ID): MontraData {
  return { ...data, budgets: data.budgets.filter((b) => b.id !== id), notifications: data.notifications.map((n) => (n.ref?.kind === 'budget' && n.ref.id === id ? { ...n, ref: null } : n)) };
}

/* ───────────── Savings ───────────── */

export type GoalInput = Pick<SavingsGoal, 'name' | 'icon' | 'target' | 'targetDate' | 'monthlyPlan' | 'accountId'>;

export function addGoal(data: MontraData, input: GoalInput, ctx: Ctx): { data: MontraData; goal: SavingsGoal } {
  const errors = validateGoal(input, data.accounts, ctx.now.slice(0, 10));
  if (hasErrors(errors)) throw new ValidationError(errors);
  const account = data.accounts.find((a) => a.id === input.accountId)!;
  const goal: SavingsGoal = { ...input, name: input.name.trim(), id: ctx.id(), currency: account.currency, status: 'active', createdAt: ctx.stamp, updatedAt: ctx.stamp };
  return { data: { ...data, goals: [...data.goals, goal] }, goal };
}

export function updateGoal(data: MontraData, id: ID, input: GoalInput, ctx: Ctx): MontraData {
  const goal = data.goals.find((g) => g.id === id);
  if (!goal) throw new ValidationError({ form: 'This goal no longer exists' });
  const saved = goalProgress(goal, data.transactions, ctx.now.slice(0, 10)).saved;
  const errors = validateGoal(input, data.accounts, ctx.now.slice(0, 10), saved);
  if (hasErrors(errors)) throw new ValidationError(errors);
  return { ...data, goals: data.goals.map((g) => (g.id === id ? { ...g, ...input, name: input.name.trim(), status: saved >= input.target ? 'completed' : 'active', updatedAt: ctx.stamp } : g)) };
}

/** Deleting a goal keeps its money where it is: contributions stay as plain transfers. */
export function deleteGoal(data: MontraData, id: ID): MontraData {
  return {
    ...data,
    goals: data.goals.filter((g) => g.id !== id),
    transactions: data.transactions.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    notifications: data.notifications.map((n) => (n.ref?.kind === 'goal' && n.ref.id === id ? { ...n, ref: null } : n)),
  };
}

/** A contribution is a real transfer from `fromAccountId` into the goal's account. */
export function addContribution(data: MontraData, goalId: ID, input: { amount: number; fromAccountId: ID; at: string; note: string }, ctx: Ctx): { data: MontraData; transaction: Transaction } {
  const goal = data.goals.find((g) => g.id === goalId);
  if (!goal) throw new ValidationError({ form: 'This goal no longer exists' });
  const before = goalProgress(goal, data.transactions, ctx.now.slice(0, 10));
  const from = data.accounts.find((a) => a.id === input.fromAccountId);
  const goalAccount = data.accounts.find((a) => a.id === goal.accountId);
  const err = validateContribution(input.amount, before.remaining, from, goalAccount);
  if (err) throw new ValidationError({ amount: err });
  const res = addTransaction(
    data,
    { type: 'transfer', amount: input.amount, description: 'Contribution', categoryId: null, accountId: input.fromAccountId, toAccountId: goal.accountId, at: input.at, note: input.note, goalId },
    ctx,
  );
  let next = res.data;
  const after = goalProgress(goal, next.transactions, ctx.now.slice(0, 10));
  if (after.complete) next = { ...next, goals: next.goals.map((g) => (g.id === goalId ? { ...g, status: 'completed', updatedAt: ctx.stamp } : g)) };
  for (const m of [25, 50, 75, 100]) {
    if (before.progress * 100 < m && after.progress * 100 >= m) {
      next = notify(next, ctx, {
        type: 'goal',
        title: m === 100 ? `${goal.name} reached!` : `${goal.name} passed ${m}%`,
        message: `${formatMoney(after.saved, goal.currency, { whole: true })} of ${formatMoney(goal.target, goal.currency, { whole: true })} saved${m === 100 ? '.' : ' — keep going.'}`,
        ref: { kind: 'goal', id: goal.id },
        key: `goal:${goal.id}:${m}`,
      });
    }
  }
  return { data: next, transaction: res.transaction };
}

/* ───────────── Notifications & settings ───────────── */

export function markRead(data: MontraData, id: ID): MontraData {
  return { ...data, notifications: data.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) };
}

export function markAllRead(data: MontraData): MontraData {
  return { ...data, notifications: data.notifications.map((n) => ({ ...n, read: true })) };
}

export function updateSettings(data: MontraData, patch: Partial<Settings>): MontraData {
  const next = { ...data.settings, ...patch };
  if (patch.name !== undefined && !patch.name.trim()) throw new ValidationError({ name: 'Enter your name' });
  if (patch.email !== undefined && patch.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patch.email.trim())) throw new ValidationError({ email: 'Enter a valid email' });
  return { ...data, settings: { ...next, name: next.name.trim(), email: next.email.trim() } };
}
