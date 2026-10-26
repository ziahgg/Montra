import { getCategory } from './categories';
import { isLocalDate, isLocalDateTime } from './dates';
import { isCents } from './money';
import type { Account, Budget, MontraData, SavingsGoal, Transaction } from './types';

export type Errors<K extends string = string> = Partial<Record<K, string>>;

export type TransactionInput = Pick<Transaction, 'type' | 'amount' | 'description' | 'categoryId' | 'accountId' | 'toAccountId' | 'at' | 'note'> & { goalId?: string | null };

const MAX_AMOUNT = 1_000_000_000_00; // $1bn in cents — guards typos.

export function validateTransaction(input: TransactionInput, data: Pick<MontraData, 'accounts'>): Errors<'amount' | 'description' | 'categoryId' | 'accountId' | 'toAccountId' | 'at' | 'note'> {
  const e: Errors<'amount' | 'description' | 'categoryId' | 'accountId' | 'toAccountId' | 'at' | 'note'> = {};
  if (!isCents(input.amount) || input.amount <= 0) e.amount = 'Enter an amount greater than zero';
  else if (input.amount > MAX_AMOUNT) e.amount = 'That amount looks too large';
  const desc = input.description.trim();
  if (input.type !== 'transfer' && !desc) e.description = input.type === 'income' ? 'Add who paid you' : 'Add a merchant';
  if (desc.length > 80) e.description = 'Keep it under 80 characters';
  const from = data.accounts.find((a) => a.id === input.accountId);
  if (!from) e.accountId = 'Choose an account';
  if (input.type === 'transfer') {
    const to = data.accounts.find((a) => a.id === input.toAccountId);
    if (!to) e.toAccountId = 'Choose where the money goes';
    else if (to.id === input.accountId) e.toAccountId = 'Pick a different account';
    else if (from && to.currency !== from.currency) e.toAccountId = 'Transfers between currencies aren’t supported yet';
  } else {
    const cat = getCategory(input.categoryId);
    if (!cat) e.categoryId = 'Choose a category';
    else if (cat.kind !== input.type) e.categoryId = `Choose an ${input.type} category`;
  }
  if (!isLocalDateTime(input.at)) e.at = 'Choose a valid date and time';
  if (input.note.length > 200) e.note = 'Keep notes under 200 characters';
  return e;
}

export function validateBudget(input: Pick<Budget, 'name' | 'categoryIds' | 'limit' | 'alertThreshold'>, existing: Budget[], editingId?: string): Errors<'name' | 'categoryIds' | 'limit' | 'alertThreshold'> {
  const e: Errors<'name' | 'categoryIds' | 'limit' | 'alertThreshold'> = {};
  if (!input.name.trim()) e.name = 'Give this budget a name';
  if (!input.categoryIds.length) e.categoryIds = 'Choose at least one category';
  else if (input.categoryIds.some((id) => getCategory(id)?.kind !== 'expense')) e.categoryIds = 'Budgets track expense categories';
  else {
    const taken = existing.filter((b) => b.id !== editingId).flatMap((b) => b.categoryIds);
    const clash = input.categoryIds.find((id) => taken.includes(id));
    if (clash) e.categoryIds = `${getCategory(clash)?.name} already has a budget`;
  }
  if (!isCents(input.limit) || input.limit <= 0) e.limit = 'Enter a monthly limit greater than zero';
  if (!Number.isInteger(input.alertThreshold) || input.alertThreshold < 1 || input.alertThreshold > 100) e.alertThreshold = 'Choose an alert between 1% and 100%';
  return e;
}

export function validateGoal(input: Pick<SavingsGoal, 'name' | 'target' | 'targetDate' | 'monthlyPlan' | 'accountId'>, accounts: Account[], today: string, alreadySaved = 0): Errors<'name' | 'target' | 'targetDate' | 'monthlyPlan' | 'accountId'> {
  const e: Errors<'name' | 'target' | 'targetDate' | 'monthlyPlan' | 'accountId'> = {};
  if (!input.name.trim()) e.name = 'Name your goal';
  if (!isCents(input.target) || input.target <= 0) e.target = 'Enter a target greater than zero';
  else if (input.target < alreadySaved) e.target = 'Target can’t be less than what’s already saved';
  if (!isLocalDate(input.targetDate)) e.targetDate = 'Choose a target date';
  else if (input.targetDate <= today) e.targetDate = 'Pick a date in the future';
  if (!isCents(input.monthlyPlan) || input.monthlyPlan < 0) e.monthlyPlan = 'Enter a monthly amount (or 0)';
  if (!accounts.some((a) => a.id === input.accountId)) e.accountId = 'Choose the account that holds this goal';
  return e;
}

export function validateContribution(amount: number, remaining: number, from: Account | undefined, goalAccount: Account | undefined): string | null {
  if (!isCents(amount) || amount <= 0) return 'Enter an amount greater than zero';
  if (amount > remaining) return remaining > 0 ? 'That’s more than this goal still needs' : 'This goal is already complete';
  if (!from) return 'Choose the account the money comes from';
  if (goalAccount && from.id === goalAccount.id) return 'Choose a different account than the goal’s own';
  if (goalAccount && from.currency !== goalAccount.currency) return 'Use an account in the same currency';
  return null;
}

export function validateAccount(input: Pick<Account, 'name' | 'type' | 'openingBalance'>): Errors<'name' | 'openingBalance'> {
  const e: Errors<'name' | 'openingBalance'> = {};
  if (!input.name.trim()) e.name = 'Name this account';
  if (input.name.trim().length > 40) e.name = 'Keep it under 40 characters';
  if (!isCents(input.openingBalance)) e.openingBalance = 'Enter a valid balance';
  return e;
}

export const hasErrors = (e: object) => Object.values(e).some(Boolean);
