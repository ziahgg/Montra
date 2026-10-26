'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import { WeekBars } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Shell';
import { TransactionRow } from '@/components/TransactionRow';
import { Button, Card, CategoryIcon, EmptyState, IconButton, ProgressBar, Tag, TopBar } from '@/components/ui';
import { addMonths, daysBetween, monthName, monthOf, monthRange } from '@/domain/dates';
import { budgetProgress, weeklySpending } from '@/domain/finance';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { stateBar, stateTag } from './BudgetsScreen';

export function BudgetDetailScreen() {
  const { data, today } = useStore();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const f = useFormat();
  const b = data.budgets.find((x) => x.id === id);
  const accounts = useMemo(() => new Map(data.accounts.map((a) => [a.id, a])), [data.accounts]);

  if (!b)
    return (
      <Screen>
        <TopBar title="Budget" back="/budgets" />
        <EmptyState icon="chart-pie" title="Budget not found" message="It may have been deleted." action={<Button onClick={() => router.push('/budgets')}>Back to budgets</Button>} />
      </Screen>
    );

  const p = budgetProgress(b, data.transactions, today);
  const tag = stateTag(p);
  const money = (c: number) => f.money(c, b.currency);
  const periodLabel = b.period === 'monthly' ? monthName(monthOf(today)) : 'this week';

  // Insight from the last three full months (monthly budgets only).
  let insight: string | null = null;
  if (b.period === 'monthly') {
    const past = [1, 2, 3].map((i) => budgetProgress(b, data.transactions, monthRange(addMonths(monthOf(today), -i)).end, monthRange(addMonths(monthOf(today), -i))).spent);
    const overCount = past.filter((s) => s > b.limit).length;
    const avg = past.reduce((s, x) => s + x, 0) / 3;
    const suggested = Math.ceil(avg / 5000) * 5000;
    if (overCount >= 2) insight = `${b.name} has gone over in ${overCount} of the last 3 months. A ${f.money(suggested, b.currency, { whole: true })} budget would match your average.`;
    else if (avg > 0) insight = `You’ve averaged ${money(Math.round(avg))} a month on ${b.name} over the last 3 months.`;
  }

  const periodDays = daysBetween(p.period.start, p.period.end) + 1;
  const clipped = { start: p.period.start, end: today < p.period.end ? today : p.period.end };
  const weeks = b.period === 'monthly' ? weeklySpending(b, data.transactions, clipped) : [];
  const weeklyLimit = Math.round((b.limit * 7) / periodDays);
  const label = (r: { start: string; end: string }) => {
    const a = f.short(r.start);
    const e = r.end.slice(5, 7) === r.start.slice(5, 7) ? (f.style === 'us' ? String(Number(r.end.slice(8))) : f.short(r.end)) : f.short(r.end);
    return f.style === 'us' ? `${a}–${e}` : `${Number(r.start.slice(8))}–${e}`;
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full icon="pencil" onClick={() => router.push(`/budgets/${b.id}/edit`)}>
          Edit budget
        </Button>
      }
    >
      <TopBar title={`${b.name} budget`} back="/budgets" right={<IconButton icon="pencil" label="Edit budget" href={`/budgets/${b.id}/edit`} />} />
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <CategoryIcon categoryId={b.categoryIds[0]} size={56} />
          <div className="min-w-0 flex-1">
            <p className="t-body text-text-muted">Spent in {periodLabel}</p>
            <p className="t-amount-l num">{money(p.spent)}</p>
          </div>
          <Tag tone={tag.tone}>{tag.label}</Tag>
        </div>
        <ProgressBar value={p.used} tone={stateBar(p)} label={`${b.name} used`} />
        <div className="flex justify-between t-caption">
          <span className="text-text-muted">
            Budget {money(b.limit)} · {b.period === 'monthly' ? 'Monthly' : 'Weekly'}
          </span>
          <span className={p.state === 'over' ? 'text-error' : 'text-text-secondary'}>{p.remaining < 0 ? `Over by ${money(-p.remaining)}` : `${money(p.remaining)} left`}</span>
        </div>
        {insight ? (
          <div className="flex gap-2.5 rounded-[14px] bg-surface-muted p-3 t-body text-text-secondary">
            <Icon name="info" size={18} className="mt-px shrink-0" />
            <p>{insight}</p>
          </div>
        ) : null}
      </Card>

      {weeks.length ? (
        <Card className="flex flex-col gap-2 p-4">
          <div className="flex items-center justify-between">
            <h2 className="t-card-title">Weekly spending</h2>
            <span className="t-caption text-text-muted">Weekly limit ≈ {f.money(weeklyLimit, b.currency, { whole: true })}</span>
          </div>
          <WeekBars bars={weeks.map((w) => ({ label: label(w.range), value: w.amount }))} limit={weeklyLimit} format={(v) => money(v)} label={`Weekly ${b.name} spending: ${weeks.map((w) => `${label(w.range)} ${money(w.amount)}`).join(', ')}`} />
          <div className="mt-2 flex gap-4 t-caption text-text-secondary">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-ink" /> Within weekly limit
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-chart-expense" /> Above weekly limit
            </span>
          </div>
        </Card>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="btx">
        <h2 id="btx" className="t-section">
          {b.name} transactions · {p.transactions.length}
        </h2>
        {p.transactions.length ? (
          <Card className="divide-y divide-divider overflow-hidden">
            {p.transactions.map((t) => (
              <TransactionRow key={t.id} t={t} accounts={accounts} />
            ))}
          </Card>
        ) : (
          <Card className="p-5 t-body text-text-secondary">Nothing spent in {b.name} {b.period === 'monthly' ? 'this month' : 'this week'} yet.</Card>
        )}
      </section>
    </Screen>
  );
}
