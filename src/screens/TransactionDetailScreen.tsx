'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { ConfirmDialog, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, Card, CategoryIcon, EmptyState, IconButton, ProgressBar, Tag, TopBar } from '@/components/ui';
import { deleteTransaction, restoreTransaction } from '@/domain/actions';
import { getCategory } from '@/domain/categories';
import { formatTime, monthName, monthOf } from '@/domain/dates';
import { budgetPeriod, budgetProgress } from '@/domain/finance';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { accountIcon, accountLabel } from './TransactionFormScreen';

export function TransactionDetailScreen() {
  const { data, apply, set } = useStore();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const [confirm, setConfirm] = useState(false);
  const t = data.transactions.find((x) => x.id === id);

  if (!t)
    return (
      <Screen>
        <TopBar title="Transaction" back="/transactions" />
        <EmptyState icon="receipt-text" title="Transaction not found" message="It may have been deleted." action={<Button onClick={() => router.push('/transactions')}>Back to transactions</Button>} />
      </Screen>
    );

  const cat = getCategory(t.categoryId);
  const from = data.accounts.find((a) => a.id === t.accountId);
  const to = t.toAccountId ? data.accounts.find((a) => a.id === t.toAccountId) : undefined;
  const goal = t.goalId ? data.goals.find((g) => g.id === t.goalId) : undefined;
  const sign = t.type === 'expense' ? -1 : t.type === 'income' ? 1 : 0;
  const budget = t.type === 'expense' && t.categoryId ? data.budgets.find((b) => b.categoryIds.includes(t.categoryId!) && b.currency === t.currency) : undefined;
  const bp = budget ? budgetProgress(budget, data.transactions, t.at.slice(0, 10), budgetPeriod(budget, t.at.slice(0, 10))) : null;

  const share = async () => {
    const text = `${t.description}: ${f.money(sign * t.amount, t.currency)} on ${f.date(t.at.slice(0, 10))}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Montra transaction', text });
      else {
        await navigator.clipboard.writeText(text);
        toast({ kind: 'info', title: 'Copied to clipboard', message: text });
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast({ kind: 'error', title: 'Couldn’t share', message: 'Sharing isn’t available here.' });
    }
  };

  const remove = () => {
    const { removed } = apply((d) => deleteTransaction(d, t.id));
    setConfirm(false);
    router.replace('/transactions');
    toast({
      kind: 'info',
      title: 'Transaction deleted',
      message: `${removed.description} · ${f.money(sign * removed.amount, removed.currency)} removed`,
      action: { label: 'Undo', onClick: () => set((d) => restoreTransaction(d, removed)) },
    });
  };

  const rows: { label: string; value: React.ReactNode }[] = [
    t.type === 'transfer'
      ? { label: 'Type', value: goal ? `Savings · ${goal.name}` : 'Transfer' }
      : {
          label: 'Category',
          value: (
            <span className="flex items-center gap-2">
              <CategoryIcon categoryId={t.categoryId} size={28} />
              {cat?.name ?? 'Uncategorized'}
            </span>
          ),
        },
    { label: 'Date', value: f.long(t.at.slice(0, 10)) },
    { label: 'Time', value: formatTime(t.at) },
    {
      label: t.type === 'transfer' ? 'From' : 'Account',
      value: (
        <span className="flex items-center gap-2">
          <Icon name={from ? accountIcon(from) : 'wallet'} size={18} className="text-text-secondary" />
          {from ? accountLabel(from) : 'Deleted account'}
        </span>
      ),
    },
    ...(t.type === 'transfer' ? [{ label: 'To', value: to ? accountLabel(to) : 'Deleted account' }] : []),
    { label: 'Note', value: t.note || <span className="text-text-muted">No note</span> },
  ];

  return (
    <Screen
      gap="gap-4"
      footer={
        <>
          <Button full icon="pencil" onClick={() => router.push(`/transactions/${t.id}/edit`)}>
            Edit
          </Button>
          <button type="button" onClick={() => setConfirm(true)} className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-error-soft t-button text-error">
            <Icon name="trash" size={20} />
            Delete
          </button>
        </>
      }
    >
      <TopBar title="Transaction" back="/transactions" right={<IconButton icon="share" label="Share" onClick={share} />} />
      <Card className="flex flex-col items-center gap-2 px-5 py-6 text-center">
        <CategoryIcon categoryId={t.categoryId} kind={t.type === 'transfer' ? (goal ? 'savings' : 'transfer') : t.type === 'income' ? 'income' : undefined} size={64} />
        <p className="t-section text-text-secondary">{t.description}</p>
        <p className={sign > 0 ? 't-amount-l num text-income' : 't-amount-l num'}>{f.money(sign * t.amount, t.currency, { sign: sign ? 'always' : 'never' })}</p>
        <div className="flex gap-2">
          <Tag>{t.type === 'expense' ? 'Expense' : t.type === 'income' ? 'Income' : 'Transfer'}</Tag>
          <Tag tone="positive">Completed</Tag>
        </div>
      </Card>
      <Card className="divide-y divide-divider px-4">
        {rows.map((r) => (
          <div key={r.label} className="flex min-h-[52px] items-center justify-between gap-4 py-3">
            <span className="t-body text-text-secondary">{r.label}</span>
            <span className="t-body-m min-w-0 text-right">{r.value}</span>
          </div>
        ))}
      </Card>
      {budget && bp ? (
        <Link href={`/budgets/${budget.id}`} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="t-card-title">
              {budget.name} budget · {monthName(monthOf(bp.period.start))}
            </span>
            <Tag tone={bp.state === 'over' ? 'error' : bp.state === 'near' ? 'warning' : 'positive'}>{bp.state === 'over' ? 'Over budget' : bp.state === 'near' ? 'Near limit' : 'On track'}</Tag>
          </div>
          <ProgressBar value={bp.used} tone={bp.state === 'over' ? 'error' : bp.state === 'near' ? 'warning' : 'ink'} label={`${budget.name} budget used`} />
          <div className="flex justify-between t-caption">
            <span className="text-text-muted">
              {f.money(bp.spent, budget.currency)} of {f.money(budget.limit, budget.currency)}
            </span>
            <span className={bp.state === 'over' ? 'text-error' : 'text-text-secondary'}>{bp.remaining < 0 ? `Over by ${f.money(-bp.remaining, budget.currency)}` : `${f.money(bp.remaining, budget.currency)} left`}</span>
          </div>
        </Link>
      ) : null}
      <ConfirmDialog
        open={confirm}
        title="Delete this transaction?"
        message={
          <>
            {t.description} · {f.money(sign * t.amount, t.currency)} will be removed and balances, budgets{t.goalId ? ' and goal progress' : ''} updated. You can undo right after.
          </>
        }
        confirmLabel="Delete transaction"
        onConfirm={remove}
        onCancel={() => setConfirm(false)}
      />
    </Screen>
  );
}
