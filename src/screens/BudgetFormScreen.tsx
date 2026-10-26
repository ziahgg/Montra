'use client';

import { useParams, useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { Icon } from '@/components/Icon';
import { ConfirmDialog, Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, EmptyState, FilterChip, IconButton, PickerField, Toggle, cx } from '@/components/ui';
import { ValidationError, addBudget, deleteBudget, updateBudget } from '@/domain/actions';
import { EXPENSE_CATEGORIES, getCategory } from '@/domain/categories';
import { daysBetween } from '@/domain/dates';
import { budgetPeriod } from '@/domain/finance';
import { CURRENCIES, parseAmount, toInput } from '@/domain/money';
import type { BudgetPeriod } from '@/domain/types';
import type { Errors } from '@/domain/validation';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

export function BudgetFormScreen({ mode }: { mode: 'new' | 'edit' }) {
  const { data, today, apply, set } = useStore();
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const existing = mode === 'edit' ? data.budgets.find((b) => b.id === id) : undefined;
  const currency = existing?.currency ?? data.settings.defaultCurrency;
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryIds[0] ?? null);
  const [limit, setLimit] = useState(existing ? toInput(existing.limit, currency) : '');
  const [period, setPeriod] = useState<BudgetPeriod>(existing?.period ?? 'monthly');
  const [alerts, setAlerts] = useState((existing?.alertThreshold ?? 80) < 100);
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const amountId = useId();

  if (mode === 'edit' && !existing)
    return (
      <Screen>
        <EmptyState icon="chart-pie" title="Budget not found" message="It may have been deleted." action={<Button onClick={() => router.push('/budgets')}>Back to budgets</Button>} />
      </Screen>
    );

  const cents = parseAmount(limit, currency);
  const range = budgetPeriod({ period }, today);
  const days = daysBetween(range.start, range.end) + 1;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '';
  const taken = new Set(data.budgets.filter((b) => b.id !== existing?.id).flatMap((b) => b.categoryIds));
  const cat = getCategory(categoryId);

  const save = () => {
    const input = { name: cat?.name ?? '', categoryIds: categoryId ? [categoryId] : [], limit: cents ?? 0, period, alertThreshold: alerts ? 80 : 100 };
    try {
      if (existing) {
        set((d, c) => updateBudget(d, existing.id, input, c));
        toast({ kind: 'success', title: 'Budget updated', message: `${input.name} · ${f.money(input.limit, currency)} ${period}` });
        router.replace(`/budgets/${existing.id}`);
      } else {
        apply((d, c) => addBudget(d, input, c));
        toast({ kind: 'success', title: 'Budget created', message: `${input.name} · ${f.money(input.limit, currency)} ${period}` });
        router.replace('/budgets');
      }
    } catch (e) {
      if (e instanceof ValidationError) setErrors({ ...e.errors, name: undefined, categoryIds: e.errors.categoryIds ?? e.errors.name });
      else toast({ kind: 'error', title: 'Couldn’t save budget' });
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full onClick={save}>
          {existing ? 'Save changes' : 'Create budget'}
        </Button>
      }
    >
      <header className="flex h-12 items-center justify-between gap-2">
        <IconButton icon="x" label="Close" onClick={() => router.back()} />
        <h1 className="t-title flex-1 text-center">{existing ? 'Edit budget' : 'New budget'}</h1>
        {existing ? <IconButton icon="trash" label="Delete budget" onClick={() => setConfirm(true)} /> : <span className="size-12" aria-hidden />}
      </header>

      <PickerField label="Category" placeholder="Choose a category" value={cat?.name} error={errors.categoryIds} onClick={() => setSheet(true)} icon={<Icon name={cat?.icon ?? 'tag'} size={20} className={errors.categoryIds ? 'text-error' : ''} />} />

      <div className={cx('flex flex-col items-center gap-1 rounded-[22px] bg-surface px-5 py-5', errors.limit ? 'border-[1.5px] border-error' : 'border border-transparent focus-within:border-ink')}>
        <label htmlFor={amountId} className="t-body text-text-secondary">
          {period === 'monthly' ? 'Monthly' : 'Weekly'} limit
        </label>
        <div className={cx('flex items-baseline t-display num', !cents && 'text-text-muted')}>
          <span aria-hidden>{symbol}</span>
          <input
            id={amountId}
            inputMode="decimal"
            placeholder="0.00"
            value={limit}
            onChange={(e) => {
              setLimit(e.target.value.replace(/[^\d.,]/g, ''));
              setErrors({ ...errors, limit: undefined });
            }}
            aria-invalid={!!errors.limit}
            className="bg-transparent text-text outline-none placeholder:text-text-muted"
            style={{ width: `${Math.max(4, limit.length + 0.5)}ch` }}
          />
        </div>
        {errors.limit ? (
          <p role="alert" className="flex items-center gap-1.5 t-body text-error">
            <Icon name="circle-alert" size={16} />
            {errors.limit}
          </p>
        ) : cents ? (
          <p className="t-caption text-text-muted">
            ≈ {f.money(Math.round(cents / days), currency)} per day{existing && existing.limit !== cents ? ` · was ${f.money(existing.limit, currency)}` : ''}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <span className="t-label text-text-secondary" id="period-l">
          Period
        </span>
        <div className="flex gap-2" role="group" aria-labelledby="period-l">
          <FilterChip selected={period === 'weekly'} onClick={() => setPeriod('weekly')}>
            Weekly
          </FilterChip>
          <FilterChip selected={period === 'monthly'} onClick={() => setPeriod('monthly')}>
            Monthly
          </FilterChip>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Info label="Starts" icon="calendar" value={f.date(range.start)} />
        <Info label="Resets" icon="repeat" value={period === 'monthly' ? 'Every 1st' : 'Every Monday'} />
      </div>
      <div className="flex items-center gap-3 rounded-[22px] bg-surface p-4">
        <span className="grid size-10 place-items-center rounded-[12px] bg-surface-muted">
          <Icon name="bell" size={20} />
        </span>
        <span className="t-item flex-1">Alert at 80% of budget</span>
        <Toggle checked={alerts} onChange={setAlerts} label="Alert at 80% of budget" />
      </div>

      <Sheet open={sheet} onClose={() => setSheet(false)} title="Select category">
        <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-2 pb-2">
          {EXPENSE_CATEGORIES.map((c) => {
            const busy = taken.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={categoryId === c.id}
                disabled={busy}
                onClick={() => {
                  setCategoryId(c.id);
                  setErrors({ ...errors, categoryIds: undefined });
                  setSheet(false);
                }}
                className={cx('flex flex-col items-center gap-2 rounded-[18px] border-[1.5px] py-3 disabled:opacity-40', categoryId === c.id ? 'border-ink bg-surface-muted' : 'border-transparent')}
              >
                <span className="relative grid size-14 place-items-center rounded-full" style={{ color: c.color }}>
                  <span className="absolute inset-0 rounded-full" style={{ background: c.color, opacity: 0.14 }} />
                  <Icon name={c.icon} size={24} className="relative" />
                </span>
                <span className="t-label">{c.short}</span>
                {busy ? <span className="t-caption text-text-muted">Has budget</span> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
      {existing ? (
        <ConfirmDialog
          open={confirm}
          title="Delete this budget?"
          message={`Your ${existing.name} transactions stay; only the limit and tracking are removed.`}
          confirmLabel="Delete budget"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            set((d) => deleteBudget(d, existing.id));
            toast({ kind: 'info', title: 'Budget deleted', message: existing.name });
            router.replace('/budgets');
          }}
        />
      ) : null}
    </Screen>
  );
}

function Info({ label, icon, value }: { label: string; icon: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="t-label text-text-secondary">{label}</span>
      <div className="flex h-[54px] items-center gap-2.5 rounded-[16px] border border-border bg-surface px-4">
        <Icon name={icon} size={20} />
        <span className="t-input truncate">{value}</span>
      </div>
    </div>
  );
}
