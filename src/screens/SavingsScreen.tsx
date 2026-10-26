'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Shell';
import { Button, EmptyState, IconButton, ProgressBar, TopBar } from '@/components/ui';
import { formatMonthShort, monthOf } from '@/domain/dates';
import { goalProgress } from '@/domain/finance';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

export function SavingsScreen() {
  const { data, today } = useStore();
  const f = useFormat();
  const router = useRouter();
  const currency = data.settings.defaultCurrency;
  const goals = data.goals.filter((g) => g.status !== 'archived' && g.currency === currency).map((g) => ({ g, p: goalProgress(g, data.transactions, today) }));
  const active = goals.filter((x) => !x.p.complete);
  const done = goals.filter((x) => x.p.complete);
  const saved = goals.reduce((s, x) => s + x.p.saved, 0);
  const target = goals.reduce((s, x) => s + x.g.target, 0);
  const pct = target ? Math.round((saved / target) * 100) : 0;
  const homes = [...new Set(goals.map((x) => data.accounts.find((a) => a.id === x.g.accountId)?.name).filter(Boolean))];

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full icon="plus" onClick={() => router.push('/savings/new')}>
          New goal
        </Button>
      }
    >
      <TopBar title="Savings goals" back="/" right={<IconButton icon="plus" label="New goal" href="/savings/new" />} />
      {goals.length === 0 ? (
        <EmptyState icon="piggy-bank" title="No savings goals yet" message="Create a goal and move money toward it from any account." />
      ) : (
        <>
          <section className="flex flex-col gap-3 rounded-[22px] bg-brand p-5 text-on-brand" aria-label="Total saved">
            <div className="flex items-start justify-between">
              <div>
                <p className="t-body opacity-80">Total saved</p>
                <p className="t-amount-l num">{f.money(saved, currency)}</p>
              </div>
              <span className="grid size-12 place-items-center rounded-full bg-ink text-on-ink">
                <Icon name="piggy-bank" size={22} />
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-label="Saved across goals" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-ink" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex justify-between gap-2 t-caption-m">
              <span>
                {pct}% of {f.money(target, currency, { whole: true })} across {goals.length} goal{goals.length === 1 ? '' : 's'}
              </span>
              <span className="truncate opacity-80">{homes.length === 1 ? `In ${homes[0]}` : `${homes.length} accounts`}</span>
            </div>
          </section>
          <GoalList title="Active goals" items={active} />
          {done.length ? <GoalList title="Completed" items={done} /> : null}
        </>
      )}
    </Screen>
  );
}

function GoalList({ title, items }: { title: string; items: { g: import('@/domain/types').SavingsGoal; p: ReturnType<typeof goalProgress> }[] }) {
  const f = useFormat();
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <h2 className="t-section">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map(({ g, p }) => (
          <li key={g.id}>
            <Link href={`/savings/${g.id}`} className="flex flex-col gap-3 rounded-[22px] bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-[14px] bg-savings-soft text-savings">
                  <Icon name={g.icon} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="t-item truncate">{g.name}</p>
                  <p className="t-caption text-text-muted">{p.complete ? 'Goal reached' : `Target · ${formatMonthShort(monthOf(g.targetDate))}`}</p>
                </div>
                <span className="t-amount-m num">{Math.floor(p.progress * 100)}%</span>
              </div>
              <ProgressBar value={p.progress * 100} tone={p.complete ? 'income' : 'savings'} label={`${g.name} progress`} />
              <div className="flex justify-between t-caption">
                <span className="t-body-m">{f.money(p.saved, g.currency, { whole: true })} saved</span>
                <span className="text-text-muted">of {f.money(g.target, g.currency, { whole: true })}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
