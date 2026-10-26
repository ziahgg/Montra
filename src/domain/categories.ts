import type { Category } from './types';

/**
 * Predefined categories. Colours are the Figma `cat/*` variables; icons are Lucide names.
 * The design has no custom-category flow, so the list is fixed.
 */
export const CATEGORIES: Category[] = [
  { id: 'groceries', name: 'Groceries', short: 'Groceries', kind: 'expense', icon: 'shopping-cart', color: '#17A34A' },
  { id: 'dining', name: 'Dining', short: 'Dining', kind: 'expense', icon: 'utensils', color: '#F07A2B' },
  { id: 'transport', name: 'Transport', short: 'Transport', kind: 'expense', icon: 'car', color: '#2F6BFF' },
  { id: 'shopping', name: 'Shopping', short: 'Shopping', kind: 'expense', icon: 'shopping-bag', color: '#E0458F' },
  { id: 'bills', name: 'Bills', short: 'Bills', kind: 'expense', icon: 'zap', color: '#E5A100' },
  { id: 'subscriptions', name: 'Subscriptions', short: 'Subscript.', kind: 'expense', icon: 'repeat', color: '#7C5CFF' },
  { id: 'health', name: 'Health', short: 'Health', kind: 'expense', icon: 'heart-pulse', color: '#E5484D' },
  { id: 'housing', name: 'Housing', short: 'Housing', kind: 'expense', icon: 'building', color: '#121316' },
  { id: 'salary', name: 'Salary', short: 'Salary', kind: 'income', icon: 'briefcase', color: '#17A34A' },
  { id: 'freelance', name: 'Freelance', short: 'Freelance', kind: 'income', icon: 'laptop', color: '#17A34A' },
  { id: 'other-income', name: 'Other income', short: 'Other', kind: 'income', icon: 'coins', color: '#17A34A' },
];

const byId = new Map(CATEGORIES.map((c) => [c.id, c]));

export function getCategory(id: string | null | undefined): Category | undefined {
  return id ? byId.get(id) : undefined;
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'expense');
export const INCOME_CATEGORIES = CATEGORIES.filter((c) => c.kind === 'income');
