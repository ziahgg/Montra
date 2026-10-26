'use client';

import Link from 'next/link';

import { getCategory } from '@/domain/categories';
import { formatTime } from '@/domain/dates';
import { formatMoney } from '@/domain/money';
import type { Account, Transaction } from '@/domain/types';
import { CategoryIcon, cx } from './ui';

/**
 * Figma "Transaction Row": category icon, title, "Category · Account", signed amount and time.
 * `perspective` shows a transfer as money in or out of that account (account history).
 */
export function TransactionRow({ t, accounts, perspective, meta }: { t: Transaction; accounts: Map<string, Account>; perspective?: string; meta?: string }) {
  const from = accounts.get(t.accountId);
  const to = t.toAccountId ? accounts.get(t.toAccountId) : undefined;
  const short = (a?: Account) => (a ? a.name.replace('Everyday ', '').replace(' Account', '') : 'Deleted account');
  let sign = 0;
  if (t.type === 'income') sign = 1;
  else if (t.type === 'expense') sign = -1;
  else if (perspective) sign = t.toAccountId === perspective ? 1 : -1;
  const amount = formatMoney(sign * t.amount, t.currency, { sign: sign ? 'always' : 'never' });
  const sub = meta ?? (t.type === 'transfer' ? `${t.goalId ? 'Savings' : 'Transfer'} · ${short(from)} → ${short(to)}` : `${getCategory(t.categoryId)?.name ?? 'Uncategorized'} · ${short(from)}`);
  return (
    <Link href={`/transactions/${t.id}`} className="flex min-h-[68px] items-center gap-3 px-4 py-3">
      <CategoryIcon categoryId={t.categoryId} kind={t.type === 'transfer' ? (t.goalId ? 'savings' : 'transfer') : t.type === 'income' ? 'income' : undefined} />
      <div className="min-w-0 flex-1">
        <p className="t-item truncate">{t.description}</p>
        <p className="t-caption truncate text-text-muted">{sub}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-0.5">
        <span className={cx('t-amount-s', t.type === 'income' && 'text-income', t.type === 'transfer' && 'text-text-secondary')}>{amount}</span>
        <span className="t-caption text-text-muted">{formatTime(t.at)}</span>
      </div>
    </Link>
  );
}
