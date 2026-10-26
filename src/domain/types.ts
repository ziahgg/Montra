import type { DateStyle, LocalDate, LocalDateTime } from './dates';
import type { Cents, CurrencyCode } from './money';

export type ID = string;

export type TransactionType = 'expense' | 'income' | 'transfer';

/**
 * One money movement. `amount` is always positive; the type gives its direction.
 * Expense: leaves `accountId`. Income: enters `accountId`.
 * Transfer: leaves `accountId`, enters `toAccountId` (same currency only).
 * A savings contribution is a transfer with `goalId` set.
 */
export interface Transaction {
  id: ID;
  type: TransactionType;
  amount: Cents;
  currency: CurrencyCode;
  description: string;
  categoryId: ID | null;
  accountId: ID;
  toAccountId: ID | null;
  goalId: ID | null;
  at: LocalDateTime;
  note: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type AccountType = 'checking' | 'savings' | 'cash' | 'credit';

export interface Account {
  id: ID;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  /** Balance at `openingDate`, before any recorded transaction. Negative for money owed. */
  openingBalance: Cents;
  openingDate: LocalDate;
  /** Last four digits, display only. */
  mask: string;
  /** Credit cards: payment due date (display). */
  dueDate: LocalDate | null;
  createdAt: string;
  updatedAt: string;
}

export type BudgetPeriod = 'monthly' | 'weekly';

export interface Budget {
  id: ID;
  name: string;
  /** One category, or several for a group. Each expense counts once even if it matches several. */
  categoryIds: ID[];
  limit: Cents;
  currency: CurrencyCode;
  period: BudgetPeriod;
  /** Percent (1–100) at which the budget is "near limit". */
  alertThreshold: number;
  createdAt: string;
  updatedAt: string;
}

export type GoalStatus = 'active' | 'completed' | 'archived';

export interface SavingsGoal {
  id: ID;
  name: string;
  icon: string;
  target: Cents;
  currency: CurrencyCode;
  targetDate: LocalDate;
  /** Contributions land here (as transfers into this account). */
  accountId: ID;
  monthlyPlan: Cents;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = 'budget' | 'bill' | 'goal' | 'transaction';

export interface AppNotification {
  id: ID;
  type: NotificationType;
  title: string;
  message: string;
  createdAt: LocalDateTime;
  read: boolean;
  ref: { kind: 'transaction' | 'budget' | 'goal' | 'account'; id: ID } | null;
  /** De-duplicates generated alerts, e.g. "budget:b-dining:2026-10:over". */
  key: string | null;
}

export interface Settings {
  name: string;
  email: string;
  defaultCurrency: CurrencyCode;
  dateStyle: DateStyle;
  budgetAlerts: boolean;
  theme: 'light' | 'dark';
  onboarded: boolean;
}

export interface Category {
  id: ID;
  name: string;
  short: string;
  kind: 'expense' | 'income';
  icon: string;
  color: string;
}

export interface MontraData {
  version: number;
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: SavingsGoal[];
  notifications: AppNotification[];
  settings: Settings;
}
