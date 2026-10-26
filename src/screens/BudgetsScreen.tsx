'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Sheet } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { CategoryIcon, DropdownPill, EmptyState, IconButton, PageHeader, ProgressBar, Tag, cx } from '@/components/ui';
import { addMonths, daysBetween, formatMonthLong, monthOf, monthRange } from '@/domain/dates';
import { budgetProgress, type BudgetProgress } from '@/domain/finance';
import type { Budget } from '@/domain/types';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { OptionRow } from './TransactionsScreen';

type Sort = 'usage' | 'remaining' | 'name';
const SORTS: { id: Sort; label: string }[] = [
  { id: 'usage', label: 'Usage' },
  { id: 'remaining', label: 'Amount left' },
  { id: 'name', label: 'Name' },
];

export const stateTag = (p: BudgetProgress) => (p.state === 'over' ? { tone: 'error' as const, label: 'Over budget' } : p.state === 'near' ? { tone: 'warning' as const, label: 'Near limit' } : { tone: 'positive' as const, label: 'On track' });
export const stateBar = (p: BudgetProgress) => (p.state === 'over' ? 'error' : p.state === 'near' ? 'warning' : 'ink') as 'error' | 'warning' | 'ink';

export function BudgetsScreen() {
  const { data, today } = useStore();
  const f = useFormat();
  const currency = data.settings.defaultCurrency;
  const [month, setMonth] = useState(monthOf(today));
  const [sort, setSort] = useState<Sort>('usage');
  const [sheet, setSheet] = useState<'month' | 'sort' | null>(null);
  const isCurrent = month === monthOf(today);
  const range = monthRange(month);
  // "Today" for the chosen month: real today in the current month, else that month's last day.
  const ref = isCurrent ? today : range.end;

  const rows = data.budgets
    .filter((b) => b.currency === currency)
    .map((b) => ({ b, p: budgetProgress(b, data.transactions, ref, b.period === 'monthly' ? range : undefined) }));
  rows.sort((x, y) => (sort === 'name' ? x.b.name.localeCompare(y.b.name) : sort === 'remaining' ? x.p.remaining - y.p.remaining : y.p.used - x.p.used));

  // Monthly summary: each expense counted once across budgets.
  const monthly = rows.filter((r) => r.b.period === 'monthly');
  const seen = new Set<string>();
  let spent = 0;
  for (const r of monthly) for (const t of r.p.transactions) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      spent += t.amount;
    }
  const limit = monthly.reduce((s, r) => s + r.b.limit, 0);
  const left = limit - spent;
  const daysLeft = isCurrent ? Math.max(0, daysBetween(today, range.end)) : 0;
  const used = limit ? (spent / limit) * 100 : 0;

  return (
    <Screen nav gap="gap-4">
      <PageHeader title="Budgets">
        <IconButton icon="plus" label="New budget" look="ink" href="/budgets/new" />
      </PageHeader>
      <div className="flex items-center gap-2">
        <DropdownPill label={formatMonthLong(month)} ariaLabel={`Month: ${formatMonthLong(month)}`} onClick={() => setSheet('month')} />
        <Tag>{isCurrent ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : 'Closed month'}</Tag>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="chart-pie" title="No budgets yet" message="Set a monthly limit for a category and Montra will track it as you spend." action={<Link href="/budgets/new" className="inline-flex h-12 items-center rounded-full bg-ink px-5 t-button text-on-ink">Create budget</Link>} />
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-[22px] bg-ink p-5 text-on-ink" aria-label="Monthly summary">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="t-body opacity-70">Spent {isCurrent ? 'this month' : `in ${formatMonthLong(month)}`}</p>
                <p className="t-amount-l num">{f.money(spent, currency)}</p>
              </div>
              <span className={cx('rounded-full px-3 py-1 t-label', used > 100 ? 'bg-error text-white' : 'bg-brand text-on-brand')}>{Math.round(used)}% used</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Budget used" aria-valuenow={Math.round(used)} aria-valuemin={0} aria-valuemax={100}>
              <div className={cx('h-full rounded-full', used > 100 ? 'bg-error' : 'bg-brand')} style={{ width: `${Math.min(100, used)}%` }} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Budget" value={f.money(limit, currency)} />
              <Stat label={left < 0 ? 'Over' : 'Left'} value={f.money(Math.abs(left), currency)} />
              <Stat label="Per day left" value={isCurrent && daysLeft && left > 0 ? f.money(Math.floor(left / daysLeft), currency) : '—'} right />
            </div>
          </section>

          <div className="flex items-center justify-between">
            <h2 className="t-section">Categories</h2>
            <button type="button" onClick={() => setSheet('sort')} className="t-body text-text-secondary" aria-haspopup="dialog">
              Sort: {SORTS.find((s) => s.id === sort)?.label} ›
            </button>
          </div>
          <ul className="flex flex-col gap-3">
            {rows.map(({ b, p }) => (
              <li key={b.id}>
                <BudgetCard b={b} p={p} />
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={sheet === 'month'} onClose={() => setSheet(null)} title="Choose month">
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 12 }, (_, i) => addMonths(monthOf(today), -i)).map((m) => (
            <button key={m} type="button" aria-pressed={m === month} onClick={() => (setMonth(m), setSheet(null))} className={cx('h-12 rounded-full t-label', m === month ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
              {formatMonthLong(m)}
            </button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'sort'} onClose={() => setSheet(null)} title="Sort budgets">
        <div className="flex flex-col gap-1">
          {SORTS.map((s) => (
            <OptionRow key={s.id} selected={sort === s.id} onClick={() => (setSort(s.id), setSheet(null))} icon="sliders" label={s.label} />
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

function Stat({ label, value, right }: { label: string; value: string; right?: boolean }) {
  return (
    <div className={cx('min-w-0', right && 'text-right')}>
      <p className="t-body opacity-70">{label}</p>
      <p className="t-card-title num truncate">{value}</p>
    </div>
  );
}

function BudgetCard({ b, p }: { b: Budget; p: BudgetProgress }) {
  const f = useFormat();
  const tag = stateTag(p);
  return (
    <Link href={`/budgets/${b.id}`} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
      <div className="flex items-center gap-3">
        <CategoryIcon categoryId={b.categoryIds[0]} />
        <div className="min-w-0 flex-1">
          <p className="t-item truncate">
            {b.name}
            {b.period === 'weekly' ? <span className="t-caption text-text-muted"> · weekly</span> : null}
          </p>
          <p className="t-caption text-text-muted">
            {f.money(p.spent, b.currency)} of {f.money(b.limit, b.currency)}
          </p>
        </div>
        <Tag tone={tag.tone}>{tag.label}</Tag>
      </div>
      <ProgressBar value={p.used} tone={stateBar(p)} label={`${b.name} used`} />
      <div className="flex justify-between t-caption">
        <span className="text-text-muted">{Math.round(p.used)}% used</span>
        <span className={p.state === 'over' ? 'text-error' : p.state === 'near' ? 'text-warning' : 'text-text-secondary'}>{p.remaining < 0 ? `Over by ${f.money(-p.remaining, b.currency)}` : `${f.money(p.remaining, b.currency)} left`}</span>
      </div>
    </Link>
  );
}
