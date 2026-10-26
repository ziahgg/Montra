'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { TransactionRow } from '@/components/TransactionRow';
import { Button, Card, DropdownPill, FilterChip, IconButton, PageHeader, SearchField, cx } from '@/components/ui';
import { CATEGORIES, getCategory } from '@/domain/categories';
import { addDays, addMonths, formatMonthLong, inRange, monthOf, monthRange } from '@/domain/dates';
import { periodTotals } from '@/domain/finance';
import type { Transaction } from '@/domain/types';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

type TypeFilter = 'all' | 'expense' | 'income' | 'transfer';

export function TransactionsScreen() {
  const { data, today } = useStore();
  const f = useFormat();
  const currency = data.settings.defaultCurrency;
  const [type, setType] = useState<TypeFilter>('all');
  const [month, setMonth] = useState(monthOf(today));
  const [category, setCategory] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'month' | 'category' | 'filters' | null>(null);
  const accounts = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  const range = monthRange(month);
  const inMonth = data.transactions.filter((t) => inRange(t.at, range));
  const q = query.trim().toLowerCase();
  const shown = inMonth
    .filter((t) => type === 'all' || t.type === type)
    .filter((t) => !category || t.categoryId === category)
    .filter((t) => !account || t.accountId === account || t.toAccountId === account)
    .filter((t) => !q || t.description.toLowerCase().includes(q) || t.note.toLowerCase().includes(q) || (getCategory(t.categoryId)?.name.toLowerCase().includes(q) ?? false))
    .sort((a, b) => b.at.localeCompare(a.at));
  const totals = periodTotals(shown, range, currency);

  const groups: { day: string; items: Transaction[] }[] = [];
  for (const t of shown) {
    const day = t.at.slice(0, 10);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(t);
    else groups.push({ day, items: [t] });
  }
  const dayLabel = (d: string) => (d === today ? `Today · ${f.day(d)}` : d === addDays(today, -1) ? `Yesterday · ${f.day(d)}` : f.day(d));
  const dayNet = (items: Transaction[]) => items.reduce((s, t) => s + (t.currency !== currency ? 0 : t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : 0), 0);
  const filtered = type !== 'all' || category || account || q;
  const clear = () => {
    setType('all');
    setCategory(null);
    setAccount(null);
    setQuery('');
  };
  const months = Array.from({ length: 12 }, (_, i) => addMonths(monthOf(today), -i));

  return (
    <Screen nav gap="gap-4">
      <PageHeader title="Transactions">
        <IconButton icon="calendar" label="Choose month" onClick={() => setSheet('month')} />
        <IconButton icon="plus" label="Add transaction" look="ink" href="/transactions/new" />
      </PageHeader>
      <SearchField value={query} onChange={setQuery} placeholder="Search merchant or note" onFilter={() => setSheet('filters')} filterActive={!!account} />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Type">
        {(
          [
            ['all', 'All'],
            ['expense', 'Expenses'],
            ['income', 'Income'],
            ['transfer', 'Transfers'],
          ] as const
        ).map(([id, label]) => (
          <FilterChip key={id} selected={type === id} onClick={() => setType(id)}>
            {label}
          </FilterChip>
        ))}
      </div>
      <div className="flex gap-2">
        <DropdownPill look="muted" label={formatMonthLong(month)} ariaLabel={`Month: ${formatMonthLong(month)}`} onClick={() => setSheet('month')} />
        <DropdownPill look="muted" label={category ? (getCategory(category)?.name ?? 'Category') : 'All categories'} ariaLabel="Category filter" onClick={() => setSheet('category')} />
      </div>

      {inMonth.length === 0 && !filtered ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-surface-muted text-text-secondary">
            <Icon name="receipt-text" size={28} />
          </span>
          <h2 className="t-section">No transactions in {formatMonthLong(month)}</h2>
          <p className="t-body max-w-[280px] text-text-secondary">Add an expense or income and it will show up here, grouped by day.</p>
          <Link href="/transactions/new" className="mt-1 inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 t-button text-on-ink">
            <Icon name="plus" size={18} />
            Add transaction
          </Link>
        </Card>
      ) : (
        <>
          <Card className="flex items-center gap-3 p-4">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-income-soft text-income">
                <Icon name="arrow-down-left" size={18} />
              </span>
              <div className="min-w-0">
                <p className="t-caption text-text-muted">Income</p>
                <p className="t-amount-s num truncate text-income">{f.money(totals.income, currency, { sign: 'always' })}</p>
              </div>
            </div>
            <span className="h-10 w-px bg-divider" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-error-soft text-error">
                <Icon name="arrow-up-right" size={18} />
              </span>
              <div className="min-w-0">
                <p className="t-caption text-text-muted">Expenses</p>
                <p className="t-amount-s num truncate">{f.money(-totals.expenses, currency)}</p>
              </div>
            </div>
          </Card>

          {groups.length === 0 ? (
            <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center" as="div">
              <span className="grid size-16 place-items-center rounded-full bg-surface-muted text-text-secondary">
                <Icon name="search" size={28} />
              </span>
              <h2 className="t-section">No results{q ? ` for “${query.trim()}”` : ''}</h2>
              <p className="t-body max-w-[280px] text-text-secondary">Try another search or remove some filters.</p>
              <Button variant="secondary" size="sm" onClick={clear}>
                Clear filters
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-4" aria-live="polite">
              {groups.map((g) => (
                <section key={g.day} aria-label={dayLabel(g.day)} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between px-0.5">
                    <h2 className="t-body-m text-text-secondary">{dayLabel(g.day)}</h2>
                    <span className="t-caption num text-text-muted">{f.money(dayNet(g.items), currency, { sign: 'always' })}</span>
                  </div>
                  <Card className="divide-y divide-divider overflow-hidden">
                    {g.items.map((t) => (
                      <TransactionRow key={t.id} t={t} accounts={accounts} perspective={account ?? undefined} />
                    ))}
                  </Card>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={sheet === 'month'} onClose={() => setSheet(null)} title="Choose month">
        <div className="grid grid-cols-2 gap-2">
          {months.map((m) => (
            <button key={m} type="button" aria-pressed={m === month} onClick={() => (setMonth(m), setSheet(null))} className={cx('h-12 rounded-full t-label', m === month ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
              {formatMonthLong(m)}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'category'} onClose={() => setSheet(null)} title="Category">
        <div className="flex flex-col gap-1">
          <OptionRow selected={!category} onClick={() => (setCategory(null), setSheet(null))} icon="tag" label="All categories" />
          {CATEGORIES.map((c) => (
            <OptionRow key={c.id} selected={category === c.id} onClick={() => (setCategory(c.id), setSheet(null))} icon={c.icon} color={c.color} label={c.name} />
          ))}
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'filters'}
        onClose={() => setSheet(null)}
        title="Filters"
        footer={
          <div className="flex gap-3">
            <Button variant="secondary" full onClick={() => (clear(), setSheet(null))}>
              Reset
            </Button>
            <Button full onClick={() => setSheet(null)}>
              Show {shown.length} result{shown.length === 1 ? '' : 's'}
            </Button>
          </div>
        }
      >
        <h3 className="t-label mb-2 text-text-secondary">Account</h3>
        <div className="flex flex-col gap-1">
          <OptionRow selected={!account} onClick={() => setAccount(null)} icon="wallet" label="All accounts" />
          {data.accounts.map((a) => (
            <OptionRow key={a.id} selected={account === a.id} onClick={() => setAccount(a.id)} icon={a.type === 'credit' ? 'credit-card' : a.type === 'cash' ? 'banknote' : a.type === 'savings' ? 'piggy-bank' : 'wallet'} label={`${a.name}${a.mask ? ` •• ${a.mask}` : ''}`} />
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}

export function OptionRow({ selected, onClick, icon, color, label, sub }: { selected: boolean; onClick: () => void; icon: string; color?: string; label: string; sub?: string }) {
  return (
    <button type="button" role="option" aria-selected={selected} onClick={onClick} className={cx('flex min-h-14 items-center gap-3 rounded-[16px] px-3 text-left', selected && 'bg-surface-muted')}>
      <span className="relative grid size-10 shrink-0 place-items-center rounded-full" style={{ color: color ?? 'var(--text)' }}>
        <span className="absolute inset-0 rounded-full" style={{ background: color ?? 'var(--surface-muted)', opacity: color ? 0.12 : 1 }} />
        <Icon name={icon} size={20} className="relative" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="t-item block truncate">{label}</span>
        {sub ? <span className="t-caption block truncate text-text-muted">{sub}</span> : null}
      </span>
      {selected ? <Icon name="check" size={20} /> : null}
    </button>
  );
}
