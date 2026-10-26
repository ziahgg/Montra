'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Donut } from '@/components/charts';
import { Screen } from '@/components/Shell';
import { Card, CategoryIcon, FilterChip, IconButton, TopBar } from '@/components/ui';
import { getCategory } from '@/domain/categories';
import { addMonths, formatMonthShort, formatMonthSpan, monthAbbr, monthOf, monthRange, type DateRange } from '@/domain/dates';
import { change, spendingByCategory } from '@/domain/finance';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { PeriodSheet, catColor, useReportPeriod, type PeriodId } from './ReportsScreen';

export function CategoryReportScreen() {
  const { data, today } = useStore();
  const f = useFormat();
  const router = useRouter();
  const period = useReportPeriod();
  const [sheet, setSheet] = useState(false);
  const currency = data.settings.defaultCurrency;
  const thisM = monthOf(today);
  const lastM = addMonths(thisM, -1);
  const chips: { key: string; label: string; range: DateRange; prev: DateRange | null; title: string }[] = [
    { key: 'cur', label: formatMonthShort(thisM), range: monthRange(thisM), prev: monthRange(lastM), title: `Spent in ${monthAbbr(thisM)}` },
    { key: 'last', label: formatMonthShort(lastM), range: monthRange(lastM), prev: monthRange(addMonths(lastM, -1)), title: `Spent in ${monthAbbr(lastM)}` },
    { key: 'period', label: period.id === '6m' ? '6 months' : period.short, range: period.range, prev: null, title: `Spent ${formatMonthSpan(period.range)}` },
  ];
  const [sel, setSel] = useState(period.id === '6m' || period.id === 'month' ? 'cur' : 'period');
  const c = chips.find((x) => x.key === sel) ?? chips[0];
  const cats = spendingByCategory(data.transactions, c.range, currency);
  const total = cats.reduce((s, x) => s + x.amount, 0);
  const prevTotal = c.prev ? spendingByCategory(data.transactions, c.prev, currency).reduce((s, x) => s + x.amount, 0) : 0;
  const delta = c.prev ? change(total, prevTotal) : null;

  return (
    <Screen gap="gap-4">
      <TopBar title="Spending by category" back={`/reports?p=${period.id}`} right={<IconButton icon="calendar" label="Report period" onClick={() => setSheet(true)} />} />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {chips.map((x) => (
          <FilterChip key={x.key} selected={x.key === sel} onClick={() => setSel(x.key)}>
            {x.label}
          </FilterChip>
        ))}
      </div>
      <Card className="flex justify-center p-5">
        <Donut size={200} thickness={30} segments={cats.map((x) => ({ name: x.categoryId, value: x.amount, color: catColor(x.categoryId) }))} label={`${c.title}: ${f.money(total, currency)}`}>
          <span className="t-caption text-text-muted">{c.title}</span>
          <span className="t-amount-m num">{f.money(total, currency)}</span>
          {delta !== null && c.prev ? (
            <span className={delta <= 0 ? 't-caption-m text-income' : 't-caption-m text-error'}>
              {delta <= 0 ? '↓' : '↑'} {Math.abs(delta)}% vs {monthAbbr(monthOf(c.prev.start))}
            </span>
          ) : null}
        </Donut>
      </Card>
      <Card className="divide-y divide-divider px-4">
        {cats.length === 0 ? <p className="py-6 t-body text-text-secondary">No spending in this period.</p> : null}
        {cats.map((x) => (
          <div key={x.categoryId} className="flex items-center gap-3 py-3.5">
            <CategoryIcon categoryId={x.categoryId} />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex justify-between gap-2">
                <span className="t-item truncate">{getCategory(x.categoryId)?.name ?? 'Uncategorized'}</span>
                <span className="t-amount-s num">{f.money(x.amount, currency)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full" style={{ width: `${x.share * 100}%`, background: catColor(x.categoryId) }} />
                </div>
                <span className="w-12 text-right t-caption num text-text-muted">{(x.share * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>
        ))}
      </Card>
      <PeriodSheet
        key={String(sheet)}
        open={sheet}
        onClose={() => setSheet(false)}
        current={period.id}
        onApply={(id: PeriodId, from?: string, to?: string) => {
          setSheet(false);
          setSel('period');
          router.replace(`/reports/categories?p=${id}${id === 'custom' ? `&from=${from}&to=${to}` : ''}`);
        }}
      />
    </Screen>
  );
}
