'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Donut, LineChart } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, Card, DropdownPill, PageHeader, cx } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { addMonths, formatMonthSpan, formatRangeLabel, isLocalDate, monthAbbr, monthName, monthOf, monthRange, type DateRange } from '@/domain/dates';
import { change, monthlySeries, periodTotals, spendingByCategory } from '@/domain/finance';
import { formatCompact } from '@/domain/money';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

export type PeriodId = 'month' | 'last' | '3m' | '6m' | 'year' | 'custom';

export const catColor = (id: string) => (id === 'housing' ? 'var(--ink)' : (getCategory(id)?.color ?? 'var(--text-muted)'));

/** Report periods from the "Report period" sheet. A custom range comes from ?from=&to=. */
export function resolvePeriod(id: PeriodId, today: string, from?: string | null, to?: string | null): { range: DateRange; label: string; short: string } {
  const m = monthOf(today);
  switch (id) {
    case 'month':
      return { range: { start: monthRange(m).start, end: today }, label: 'This month', short: 'This month' };
    case 'last':
      return { range: monthRange(addMonths(m, -1)), label: 'Last month', short: 'Last month' };
    case '3m':
      return { range: { start: monthRange(addMonths(m, -2)).start, end: today }, label: 'Last 3 months', short: '3 Months' };
    case 'year':
      return { range: { start: `${today.slice(0, 4)}-01-01`, end: today }, label: 'This year', short: 'This year' };
    case 'custom':
      if (from && to && isLocalDate(from) && isLocalDate(to) && from <= to) return { range: { start: from, end: to }, label: 'Custom range', short: 'Custom' };
      return resolvePeriod('6m', today);
    default:
      return { range: { start: monthRange(addMonths(m, -5)).start, end: today }, label: 'Last 6 months', short: '6 Months' };
  }
}

export function useReportPeriod() {
  const { today } = useStore();
  const search = useSearchParams();
  const id = (['month', 'last', '3m', '6m', 'year', 'custom'].includes(search.get('p') ?? '') ? search.get('p') : '6m') as PeriodId;
  const from = search.get('from');
  const to = search.get('to');
  return { id, from, to, ...resolvePeriod(id, today, from, to) };
}

export function PeriodSheet({ open, onClose, current, onApply }: { open: boolean; onClose: () => void; current: PeriodId; onApply: (id: PeriodId, from?: string, to?: string) => void }) {
  const { today } = useStore();
  const f = useFormat();
  const [sel, setSel] = useState<PeriodId>(current);
  const [from, setFrom] = useState(monthRange(addMonths(monthOf(today), -1)).start);
  const [to, setTo] = useState(today);
  const bad = sel === 'custom' && (!isLocalDate(from) || !isLocalDate(to) || from > to);
  const opts: PeriodId[] = ['month', 'last', '3m', '6m', 'year'];
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Report period"
      footer={
        <Button full disabled={bad} onClick={() => onApply(sel, from, to)}>
          Apply
        </Button>
      }
    >
      <div role="radiogroup" aria-label="Report period" className="flex flex-col gap-1">
        {opts.map((o) => {
          const p = resolvePeriod(o, today);
          return (
            <button key={o} type="button" role="radio" aria-checked={sel === o} onClick={() => setSel(o)} className={cx('flex min-h-16 items-center gap-3 rounded-[16px] px-4 text-left', sel === o && 'bg-surface-muted')}>
              <span className="flex-1">
                <span className="t-item block">{p.label}</span>
                <span className="t-caption text-text-muted">{o === 'month' || o === 'last' ? formatRangeLabel(p.range, f.style) : formatMonthSpan(p.range)}</span>
              </span>
              <span className={cx('grid size-6 place-items-center rounded-full', sel === o ? 'bg-ink text-on-ink' : 'border-[1.5px] border-border')}>{sel === o ? <Icon name="check" size={14} /> : null}</span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={sel === 'custom'} onClick={() => setSel('custom')} className={cx('flex min-h-16 items-center gap-3 rounded-[16px] px-4 text-left', sel === 'custom' && 'bg-surface-muted')}>
          <span className="flex-1">
            <span className="t-item block">Custom range</span>
            <span className="t-caption text-text-muted">Pick start and end dates</span>
          </span>
          <Icon name="chevron-right" size={18} className="text-text-muted" />
        </button>
        {sel === 'custom' ? (
          <div className="grid grid-cols-2 gap-3 px-1 pt-2">
            <label className="flex flex-col gap-1.5 t-label text-text-secondary">
              From
              <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} className="h-12 rounded-[14px] border border-border bg-surface px-3 t-input text-text" />
            </label>
            <label className="flex flex-col gap-1.5 t-label text-text-secondary">
              To
              <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} className="h-12 rounded-[14px] border border-border bg-surface px-3 t-input text-text" />
            </label>
            {bad ? <p className="col-span-2 t-caption text-error">The start date must be on or before the end date.</p> : null}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

export function ReportsScreen() {
  const { data } = useStore();
  const f = useFormat();
  const router = useRouter();
  const period = useReportPeriod();
  const currency = data.settings.defaultCurrency;
  const [sheet, setSheet] = useState(false);
  const series = monthlySeries(data.transactions, period.range, currency);
  const [active, setActive] = useState<number | null>(null);
  const ai = active !== null && active < series.length ? active : series.length - 1;
  const cur = series[ai];
  const prevMonth = cur ? addMonths(cur.month, -1) : null;
  const prev = prevMonth ? periodTotals(data.transactions, monthRange(prevMonth), currency) : null;
  const lastMonth = series[series.length - 1];
  const kept = lastMonth && lastMonth.income ? Math.round(((lastMonth.income - lastMonth.expenses) / lastMonth.income) * 100) : null;
  // The category card follows the month picked on the chart (clipped to the period).
  const catRange = cur ? { start: monthRange(cur.month).start < period.range.start ? period.range.start : monthRange(cur.month).start, end: monthRange(cur.month).end > period.range.end ? period.range.end : monthRange(cur.month).end } : period.range;
  const cats = spendingByCategory(data.transactions, catRange, currency);
  const total = cats.reduce((s, c) => s + c.amount, 0);
  const qs = `p=${period.id}${period.id === 'custom' ? `&from=${period.range.start}&to=${period.range.end}` : ''}`;

  const apply = (id: PeriodId, from?: string, to?: string) => {
    setSheet(false);
    setActive(null);
    router.replace(`/reports?p=${id}${id === 'custom' ? `&from=${from}&to=${to}` : ''}`);
  };

  return (
    <Screen nav gap="gap-4">
      <PageHeader title="Reports">
        <DropdownPill label={period.short} ariaLabel={`Report period: ${period.label}`} onClick={() => setSheet(true)} />
      </PageHeader>

      {lastMonth && kept !== null ? (
        <Link href={`/reports/categories?${qs}`} className="flex items-center gap-3 rounded-[22px] bg-ink p-3 pr-4 text-on-ink">
          <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-brand text-on-brand">
            <Icon name="sparkles" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="t-card-title block">{kept >= 0 ? `You kept ${kept}% of ${monthName(lastMonth.month)} income` : `You spent more than you earned in ${monthName(lastMonth.month)}`}</span>
            <span className="t-caption block opacity-70">Net {f.money(lastMonth.income - lastMonth.expenses, currency, { sign: 'always' })} after expenses</span>
          </span>
          <Icon name="chevron-right" size={18} />
        </Link>
      ) : null}

      <Card className="flex flex-col gap-3 p-4">
        <div>
          <h2 className="t-section">Cash flow</h2>
          <p className="t-caption text-text-muted">Income vs. expenses · {formatMonthSpan(period.range)}</p>
        </div>
        <div className="flex gap-4 t-label">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-income" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-chart-expense" /> Expenses
          </span>
        </div>
        {series.length ? (
          <>
            <LineChart
              labels={series.map((s) => monthAbbr(s.month))}
              series={[
                { name: 'Income', color: 'var(--chart-income)', values: series.map((s) => s.income) },
                { name: 'Expenses', color: 'var(--chart-expense)', values: series.map((s) => s.expenses) },
              ]}
              active={ai}
              formatAxis={(v) => formatCompact(v, currency)}
              formatValue={(v) => f.money(v, currency, { whole: true })}
              summary={series.map((s) => `${monthAbbr(s.month)}: income ${f.money(s.income, currency)}, expenses ${f.money(s.expenses, currency)}`).join('; ')}
            />
            <div className="flex justify-between gap-1" role="group" aria-label="Choose month">
              {series.map((s, i) => (
                <button key={s.month} type="button" aria-pressed={i === ai} onClick={() => setActive(i)} className={cx('h-8 min-w-0 flex-1 rounded-full t-caption-m', i === ai ? 'bg-ink text-on-ink' : 'border border-border')}>
                  {monthAbbr(s.month)}
                </button>
              ))}
            </div>
          </>
        ) : null}
        {cur && prev && prevMonth ? (
          <div className="grid grid-cols-2 gap-3">
            <Compare label={`${monthAbbr(cur.month)} income vs ${monthAbbr(prevMonth)}`} value={f.money(cur.income, currency)} delta={change(cur.income, prev.income)} goodWhenUp />
            <Compare label={`${monthAbbr(cur.month)} expenses vs ${monthAbbr(prevMonth)}`} value={f.money(cur.expenses, currency)} delta={change(cur.expenses, prev.expenses)} />
          </div>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <h2 className="t-section">Spending by category{cur ? ` · ${monthAbbr(cur.month)}` : ''}</h2>
          <Link href={`/reports/categories?${qs}`} className="inline-flex items-center gap-1 t-body text-text-secondary">
            Details <Icon name="chevron-right" size={16} />
          </Link>
        </div>
        {total ? (
          <>
            <div className="flex items-center gap-4">
              <Donut segments={cats.map((c) => ({ name: c.categoryId, value: c.amount, color: catColor(c.categoryId) }))} label={`Spending by category, total ${f.money(total, currency)}`}>
                <span className="t-caption text-text-muted">Total</span>
                <span className="t-card-title num">{f.money(total, currency, { whole: true })}</span>
              </Donut>
              <ul className="flex min-w-0 flex-1 flex-col gap-1.5">
                {cats.slice(0, 5).map((c) => (
                  <li key={c.categoryId} className="flex items-center gap-2 t-label">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: catColor(c.categoryId) }} />
                    <span className="min-w-0 flex-1 truncate">{getCategory(c.categoryId)?.name ?? 'Uncategorized'}</span>
                    <span className="num text-text-muted">{(c.share * 100).toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            {cats.length > 1 ? (
              <p className="flex gap-2.5 rounded-[14px] bg-surface-muted p-3 t-body text-text-secondary">
                <Icon name="info" size={18} className="mt-px shrink-0" />
                {getCategory(cats[0].categoryId)?.name} is your largest expense at {f.money(cats[0].amount, currency)}. {getCategory(cats[1].categoryId)?.name} comes next at {f.money(cats[1].amount, currency)}.
              </p>
            ) : null}
          </>
        ) : (
          <p className="t-body text-text-secondary">No spending in this period.</p>
        )}
      </Card>

      <PeriodSheet key={String(sheet)} open={sheet} onClose={() => setSheet(false)} current={period.id} onApply={apply} />
    </Screen>
  );
}

function Compare({ label, value, delta, goodWhenUp }: { label: string; value: string; delta: number | null; goodWhenUp?: boolean }) {
  const good = delta === null ? null : goodWhenUp ? delta >= 0 : delta <= 0;
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-[16px] bg-surface-muted p-3">
      <span className="t-caption text-text-muted">{label}</span>
      <span className="flex flex-wrap items-baseline gap-x-1.5">
        <span className="t-card-title num">{value}</span>
        {delta !== null ? (
          <span className={cx('t-caption-m num', good ? 'text-income' : 'text-error')}>
            {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        ) : null}
      </span>
    </div>
  );
}
