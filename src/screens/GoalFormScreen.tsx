'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { ConfirmDialog, Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, EmptyState, IconButton, InputField, PickerField, cx } from '@/components/ui';
import { ValidationError, addGoal, deleteGoal, updateGoal } from '@/domain/actions';
import { addMonths, formatMonthShort, monthEnd, monthOf } from '@/domain/dates';
import { goalProgress } from '@/domain/finance';
import { parseAmount, toInput } from '@/domain/money';
import type { Errors } from '@/domain/validation';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { OptionRow } from './TransactionsScreen';
import { accountIcon, accountLabel } from './TransactionFormScreen';

const ICONS = ['laptop', 'plane', 'car', 'gift', 'building', 'target', 'shield', 'house'];

export function GoalFormScreen({ mode }: { mode: 'new' | 'edit' }) {
  const { data, today, apply, set } = useStore();
  const { id } = useParams<{ id?: string }>();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const existing = mode === 'edit' ? data.goals.find((g) => g.id === id) : undefined;
  const defaultAcc = data.accounts.find((a) => a.type === 'savings') ?? data.accounts[0];
  const [icon, setIcon] = useState(existing?.icon ?? 'target');
  const [name, setName] = useState(existing?.name ?? '');
  const [target, setTarget] = useState(existing ? toInput(existing.target, existing.currency) : '');
  const [month, setMonth] = useState(existing ? monthOf(existing.targetDate) : addMonths(monthOf(today), 6));
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAcc?.id ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [pick, setPick] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (mode === 'edit' && !existing)
    return (
      <Screen>
        <EmptyState icon="piggy-bank" title="Goal not found" message="It may have been deleted." action={<Button onClick={() => router.push('/savings')}>Back to savings</Button>} />
      </Screen>
    );

  const account = data.accounts.find((a) => a.id === accountId);
  const currency = existing?.currency ?? account?.currency ?? data.settings.defaultCurrency;
  const cents = parseAmount(target, currency);
  const saved = existing ? goalProgress(existing, data.transactions, today).saved : 0;
  // Contributions start next month and run through the target month.
  const first = addMonths(monthOf(today), 1);
  const months = Math.max(0, (Number(month.slice(0, 4)) - Number(first.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(first.slice(5, 7)) + 1);
  const needed = cents ? Math.max(0, cents - saved) : 0;
  const plan = months > 0 && needed > 0 ? Math.ceil(needed / months / 1000) * 1000 : 0;

  const save = () => {
    const input = { name, icon, target: cents ?? 0, targetDate: monthEnd(month), monthlyPlan: plan, accountId };
    try {
      if (existing) {
        set((d, c) => updateGoal(d, existing.id, input, c));
        toast({ kind: 'success', title: 'Goal updated', message: name.trim() });
        router.replace(`/savings/${existing.id}`);
      } else {
        apply((d, c) => addGoal(d, input, c));
        toast({ kind: 'success', title: 'Goal created', message: `${name.trim()} · ${f.money(input.target, currency, { whole: true })} by ${formatMonthShort(month)}` });
        router.replace('/savings');
      }
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors);
      else toast({ kind: 'error', title: 'Couldn’t save goal' });
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full onClick={save}>
          {existing ? 'Save changes' : 'Create goal'}
        </Button>
      }
    >
      <header className="flex h-12 items-center justify-between gap-2">
        <IconButton icon="x" label="Close" onClick={() => router.back()} />
        <h1 className="t-title flex-1 text-center">{existing ? 'Edit goal' : 'New goal'}</h1>
        {existing ? <IconButton icon="trash" label="Delete goal" onClick={() => setConfirm(true)} /> : <span className="size-12" aria-hidden />}
      </header>
      <div className="flex flex-col gap-2">
        <span id="icon-l" className="t-label text-text-secondary">
          Icon
        </span>
        <div role="radiogroup" aria-labelledby="icon-l" className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {ICONS.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={icon === i} aria-label={i} onClick={() => setIcon(i)} className={cx('grid size-[52px] shrink-0 place-items-center rounded-[16px]', icon === i ? 'bg-ink text-on-ink' : 'border border-border bg-surface')}>
              <Icon name={i} size={22} />
            </button>
          ))}
        </div>
      </div>
      <InputField label="Goal name" icon={icon} value={name} maxLength={40} onChange={(e) => (setName(e.target.value), setErrors({ ...errors, name: undefined }))} placeholder="e.g. Home Office Setup" error={errors.name} />
      <InputField label="Target amount" icon="dollar" inputMode="decimal" value={target} onChange={(e) => (setTarget(e.target.value.replace(/[^\d.,]/g, '')), setErrors({ ...errors, target: undefined }))} placeholder="0.00" error={errors.target} helper={saved ? `${f.money(saved, currency)} already saved` : undefined} />
      <InputField label="Target date" icon="calendar" type="month" min={addMonths(monthOf(today), 1)} value={month} onChange={(e) => (setMonth(e.target.value || month), setErrors({ ...errors, targetDate: undefined }))} error={errors.targetDate} />
      <PickerField label="Save into" placeholder="Choose an account" value={account ? accountLabel(account) : undefined} error={errors.accountId} onClick={() => setPick(true)} icon={<Icon name={account ? accountIcon(account) : 'wallet'} size={20} />} />
      {plan ? (
        <div className="flex gap-3 rounded-[16px] bg-savings-soft p-4">
          <Icon name="sparkles" size={20} className="shrink-0 text-savings" />
          <div>
            <p className="t-item">Save {f.money(plan, currency, { whole: true })} a month</p>
            <p className="t-caption text-text-secondary">
              {months} monthly contribution{months === 1 ? '' : 's'} from {formatMonthShort(first)} reach {f.money(cents ?? 0, currency, { whole: true })} by {formatMonthShort(month)}.
            </p>
          </div>
        </div>
      ) : null}
      <Sheet open={pick} onClose={() => setPick(false)} title="Save into">
        <div className="flex flex-col gap-1">
          {data.accounts
            .filter((a) => !existing || a.currency === existing.currency)
            .map((a) => (
              <OptionRow key={a.id} selected={a.id === accountId} onClick={() => (setAccountId(a.id), setPick(false))} icon={accountIcon(a)} label={accountLabel(a)} sub={a.currency} />
            ))}
        </div>
      </Sheet>
      {existing ? (
        <ConfirmDialog
          open={confirm}
          title="Delete this goal?"
          message={`${f.money(saved, currency)} stays in your accounts — contributions become regular transfers.`}
          confirmLabel="Delete goal"
          onCancel={() => setConfirm(false)}
          onConfirm={() => {
            set((d) => deleteGoal(d, existing.id));
            toast({ kind: 'info', title: 'Goal deleted', message: existing.name });
            router.replace('/savings');
          }}
        />
      ) : null}
    </Screen>
  );
}
