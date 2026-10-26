'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { TransactionRow } from '@/components/TransactionRow';
import { ActionPill, Card, DropdownPill, IconButton, ProgressBar, SectionHeader, Tag, cx } from '@/components/ui';
import { CURRENCIES, type CurrencyCode } from '@/domain/money';
import { addMonths, monthName, monthOf, monthRange } from '@/domain/dates';
import { budgetSummary, change, goalProgress, netWorth, periodTotals, spendingByCategory } from '@/domain/finance';
import { getCategory } from '@/domain/categories';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

function greeting(now: Date) {
  const h = now.getHours();
  return h < 12 ? 'Good morning,' : h < 18 ? 'Good afternoon,' : 'Good evening,';
}

export function HomeScreen() {
  const { data, today } = useStore();
  const f = useFormat();
  const [more, setMore] = useState(false);
  const [currencySheet, setCurrencySheet] = useState(false);
  const worth = useMemo(() => netWorth(data), [data]);
  const [picked, setPicked] = useState<CurrencyCode | null>(null);
  const currency = picked && worth.some((w) => w.currency === picked) ? picked : (worth.find((w) => w.currency === data.settings.defaultCurrency)?.currency ?? worth[0]?.currency ?? data.settings.defaultCurrency);
  const row = worth.find((w) => w.currency === currency);
  const month = monthOf(today);
  const totals = periodTotals(data.transactions, monthRange(month), currency);
  const prev = periodTotals(data.transactions, monthRange(addMonths(month, -1)), currency);
  const spentChange = change(totals.expenses, prev.expenses);
  const incomeChange = change(totals.income, prev.income);
  const cats = spendingByCategory(data.transactions, monthRange(month), currency).slice(0, 4);
  const budget = budgetSummary(data.budgets, data.transactions, today, currency);
  const goals = data.goals.filter((g) => g.status !== 'archived' && g.currency === currency);
  const savedTotal = goals.reduce((s, g) => s + goalProgress(g, data.transactions, today).saved, 0);
  const recent = [...data.transactions].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4);
  const accounts = new Map(data.accounts.map((a) => [a.id, a]));
  const unread = data.notifications.some((n) => !n.read);
  const firstName = data.settings.name;

  return (
    <Screen nav gap="gap-5">
      <Card className="flex items-center gap-3 p-3">
        <Link href="/profile" aria-label="Profile" className="grid size-14 shrink-0 place-items-center rounded-full bg-brand t-title text-on-brand">
          {firstName
            .split(' ')
            .map((p) => p[0])
            .join('')
            .slice(0, 2)
            .toUpperCase()}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="t-body text-text-muted">{greeting(new Date())}</p>
          <p className="t-title truncate">{firstName}</p>
        </div>
        <IconButton icon="bell" label={unread ? 'Notifications, unread' : 'Notifications'} look="muted" href="/notifications" badge={unread} />
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="t-section">Total balance</h2>
            <p className="t-body text-text-muted">
              Across {row?.accounts ?? 0} account{row?.accounts === 1 ? '' : 's'}
            </p>
          </div>
          <DropdownPill label={currency} ariaLabel={`Currency: ${currency}`} onClick={() => setCurrencySheet(true)} />
        </div>
        <p className="t-balance num">{f.money(row?.net ?? 0, currency)}</p>
        <div className="flex gap-2.5">
          <ActionPill icon="minus" label="Expense" href="/transactions/new?type=expense" />
          <ActionPill icon="plus" label="Income" href="/transactions/new?type=income" />
          <IconButton icon="ellipsis" label="More actions" look="ink" onClick={() => setMore(true)} />
        </div>
      </Card>

      <section aria-labelledby="overview" className="flex flex-col gap-3">
        <SectionHeader id="overview" title={`${monthName(month)} overview`} href="/reports" linkLabel="Reports" />
        <div className="grid grid-cols-2 gap-3">
          <Link href="/reports" className="flex min-h-[188px] flex-col justify-between rounded-[22px] bg-ink p-4 text-on-ink">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-full bg-on-ink text-ink">
                <Icon name="arrow-up-right" size={20} />
              </span>
              {spentChange !== null ? <ChangePill value={spentChange} dark /> : null}
            </div>
            <div className="flex flex-col gap-2">
              <span className="t-body opacity-70">Spent</span>
              <span className="t-amount-m num">{f.money(totals.expenses, currency)}</span>
              <div className="flex h-1.5 gap-1" aria-hidden>
                {cats.map((c, i) => (
                  <span key={c.categoryId} className="rounded-full" style={{ flex: Math.max(c.share, 0.06), background: i === 0 ? 'var(--on-ink)' : getCategory(c.categoryId)?.color }} />
                ))}
              </div>
            </div>
          </Link>
          <Link href="/reports" className="flex min-h-[188px] flex-col justify-between rounded-[22px] bg-brand p-4 text-on-brand">
            <div className="flex items-center justify-between">
              <span className="grid size-10 place-items-center rounded-full bg-ink text-on-ink">
                <Icon name="arrow-down-left" size={20} />
              </span>
              {incomeChange !== null ? <ChangePill value={incomeChange} /> : null}
            </div>
            <div className="flex flex-col gap-1">
              <span className="t-body opacity-80">Income</span>
              <span className="t-amount-m num">{f.money(totals.income, currency)}</span>
              <span className="t-caption-m opacity-80">Net {f.money(totals.net, currency, { sign: 'always' })}</span>
            </div>
          </Link>
        </div>
      </section>

      <section aria-labelledby="budgets-h" className="flex flex-col gap-3">
        <SectionHeader id="budgets-h" title="Budgets" href="/budgets" />
        {budget.limit ? (
          <Link href="/budgets" className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
            <span className="t-body text-text-muted">Spent of {f.money(budget.limit, currency)}</span>
            <div className="flex items-center justify-between gap-2">
              <span className="t-amount-l num">{f.money(budget.spent, currency)}</span>
              <Tag tone={budget.used > 100 ? 'error' : budget.used >= 80 ? 'warning' : 'positive'}>{Math.round(budget.used)}% used</Tag>
            </div>
            <ProgressBar value={budget.used} tone={budget.used > 100 ? 'error' : 'ink'} label="Monthly budgets used" />
            <div className="flex justify-between t-body">
              <span className="t-body-m">{budget.remaining >= 0 ? `${f.money(budget.remaining, currency)} left` : `${f.money(-budget.remaining, currency)} over`}</span>
              <span className="text-text-muted">
                {budget.daysLeft} day{budget.daysLeft === 1 ? '' : 's'} to go
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/budgets/new" className="flex items-center gap-3 rounded-[22px] bg-surface p-4">
            <Icon name="plus" size={20} />
            <span className="t-item">Create your first budget</span>
          </Link>
        )}
      </section>

      <section aria-labelledby="savings-h" className="flex flex-col gap-3">
        <SectionHeader id="savings-h" title="Savings" href="/savings" />
        <Link href="/savings" className="flex items-center gap-3 rounded-[22px] bg-surface p-4">
          <span className="grid size-11 place-items-center rounded-full bg-savings-soft text-savings">
            <Icon name="piggy-bank" size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="t-item">
              {goals.length} goal{goals.length === 1 ? '' : 's'}
            </p>
            <p className="t-caption text-text-muted">Saved so far</p>
          </div>
          <span className="t-amount-s num">{f.money(savedTotal, currency, { whole: true })}</span>
        </Link>
      </section>

      <section aria-labelledby="recent-h" className="flex flex-col gap-3">
        <SectionHeader id="recent-h" title="Recent transactions" href="/transactions" />
        {recent.length ? (
          <Card className="divide-y divide-divider overflow-hidden">
            {recent.map((t) => (
              <TransactionRow key={t.id} t={t} accounts={accounts} />
            ))}
          </Card>
        ) : (
          <Card className="p-5 t-body text-text-secondary">No transactions yet. Add your first expense or income above.</Card>
        )}
      </section>

      <Sheet open={more} onClose={() => setMore(false)} title="Quick actions">
        <div className="flex flex-col divide-y divide-divider">
          {[
            { href: '/transactions/new?type=transfer', icon: 'arrow-left-right', label: 'Transfer between accounts' },
            { href: '/savings', icon: 'piggy-bank', label: 'Add to a savings goal' },
            { href: '/accounts', icon: 'wallet', label: 'Accounts' },
            { href: '/accounts/new', icon: 'plus', label: 'Add account' },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex min-h-14 items-center gap-3">
              <span className="grid size-10 place-items-center rounded-[12px] bg-surface-muted">
                <Icon name={a.icon} size={20} />
              </span>
              <span className="t-item flex-1">{a.label}</span>
              <Icon name="chevron-right" size={18} className="text-text-muted" />
            </Link>
          ))}
        </div>
      </Sheet>

      <Sheet open={currencySheet} onClose={() => setCurrencySheet(false)} title="Show balance in">
        <div className="flex flex-col gap-2">
          {worth.map((w) => (
            <button
              key={w.currency}
              type="button"
              onClick={() => {
                setPicked(w.currency);
                setCurrencySheet(false);
              }}
              className={cx('flex min-h-14 items-center justify-between rounded-[16px] px-4', w.currency === currency ? 'bg-ink text-on-ink' : 'bg-surface-muted')}
            >
              <span className="t-item">{CURRENCIES.find((c) => c.code === w.currency)?.label ?? w.currency}</span>
              <span className="t-amount-s num">{f.money(w.net, w.currency)}</span>
            </button>
          ))}
          <p className="t-caption text-text-muted">Balances are shown per currency and never converted.</p>
        </div>
      </Sheet>
    </Screen>
  );
}

function ChangePill({ value, dark }: { value: number; dark?: boolean }) {
  return (
    <span className={cx('inline-flex h-7 items-center gap-1 rounded-full px-2.5 t-caption-m num', dark ? 'bg-white/90 text-[#121316]' : 'bg-white/80 text-[#121316]')} aria-label={`${value >= 0 ? 'Up' : 'Down'} ${Math.abs(value)}% from last month`}>
      <Icon name={value >= 0 ? 'arrow-up-right' : 'arrow-down-left'} size={13} />
      {Math.abs(value)}%
    </span>
  );
}
