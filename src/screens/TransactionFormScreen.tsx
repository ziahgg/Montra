'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';

import { Icon } from '@/components/Icon';
import { Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, EmptyState, IconButton, PickerField, Segmented, cx } from '@/components/ui';
import { ValidationError, addTransaction, updateTransaction } from '@/domain/actions';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, getCategory } from '@/domain/categories';
import { addDays, formatTime } from '@/domain/dates';
import { budgetProgress } from '@/domain/finance';
import { fractionDigits, parseAmount, toInput, CURRENCIES } from '@/domain/money';
import type { Account, TransactionType } from '@/domain/types';
import type { Errors } from '@/domain/validation';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { OptionRow } from './TransactionsScreen';

export const accountIcon = (a: Pick<Account, 'type'>) => (a.type === 'credit' ? 'credit-card' : a.type === 'cash' ? 'banknote' : a.type === 'savings' ? 'piggy-bank' : 'wallet');
export const accountLabel = (a: Account) => `${a.name}${a.mask ? ` •• ${a.mask}` : ''}`;

export function TransactionFormScreen({ mode }: { mode: 'new' | 'edit' }) {
  const { data, today, apply, ctx } = useStore();
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const existing = mode === 'edit' ? data.transactions.find((t) => t.id === params.id) : undefined;
  const initialType = (existing?.type ?? (['expense', 'income', 'transfer'].includes(search.get('type') ?? '') ? search.get('type') : 'expense')) as TransactionType;
  const defaultAccount = data.accounts.find((a) => a.type === 'checking') ?? data.accounts[0];

  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState(existing ? toInput(existing.amount, existing.currency) : '');
  const [categoryId, setCategoryId] = useState<string | null>(existing?.categoryId ?? null);
  const [description, setDescription] = useState(existing?.description ?? '');
  const [at, setAt] = useState(existing?.at ?? ctx().now);
  const [accountId, setAccountId] = useState(existing?.accountId ?? defaultAccount?.id ?? '');
  const [toAccountId, setToAccountId] = useState<string | null>(existing?.toAccountId ?? data.accounts.find((a) => a.type === 'savings' && a.id !== accountId)?.id ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const [sheet, setSheet] = useState<'category' | 'account' | 'to' | null>(null);
  const [pendingCat, setPendingCat] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const ids = { merchant: useId(), date: useId(), note: useId(), amount: useId() };

  if (mode === 'edit' && !existing)
    return (
      <Screen>
        <EmptyState icon="receipt-text" title="Transaction not found" message="It may have been deleted." action={<Button onClick={() => router.push('/transactions')}>Back to transactions</Button>} />
      </Screen>
    );
  if (!defaultAccount)
    return (
      <Screen>
        <EmptyState icon="wallet" title="Add an account first" message="Transactions need an account to come from or go into." action={<Button onClick={() => router.push('/accounts/new')}>Add account</Button>} />
      </Screen>
    );

  const account = data.accounts.find((a) => a.id === accountId);
  const currency = account?.currency ?? data.settings.defaultCurrency;
  const symbol = CURRENCIES.find((c) => c.code === currency)?.symbol ?? '';
  const cents = parseAmount(amount, currency);
  const category = getCategory(categoryId);
  const cats = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const isSavingsLinked = !!existing?.goalId;

  // Budget hint for expenses: how this category's budget stands for the chosen date.
  let hint: string | null = null;
  if (type === 'expense' && categoryId) {
    const b = data.budgets.find((x) => x.categoryIds.includes(categoryId) && x.currency === currency);
    if (b) {
      const others = data.transactions.filter((t) => t.id !== existing?.id);
      const p = budgetProgress(b, others, at.slice(0, 10));
      const after = p.spent + (cents ?? 0);
      if (p.spent > b.limit) hint = `${b.name} is already ${f.money(p.spent - b.limit, currency)} over budget`;
      else if (after > b.limit) hint = `This puts ${b.name} ${f.money(after - b.limit, currency)} over budget`;
      else if (cents) hint = `${f.money(b.limit - after, currency)} left in ${b.name} after this`;
    }
  }
  const hintOver = hint?.includes('over');

  const changeType = (t: TransactionType) => {
    setType(t);
    setErrors({});
    if (getCategory(categoryId)?.kind !== t) setCategoryId(null);
  };

  const save = () => {
    const input = {
      type,
      amount: cents ?? 0,
      description: type === 'transfer' && !description.trim() ? 'Transfer' : description,
      categoryId: type === 'transfer' ? null : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      at,
      note,
      goalId: existing?.goalId ?? null,
    };
    try {
      setSaving(true);
      if (existing) {
        apply((d, c) => updateTransaction(d, existing.id, input, c));
        toast({ kind: 'success', title: 'Changes saved', message: `${input.description} · ${f.money(input.amount, currency)}` });
        router.replace(`/transactions/${existing.id}`);
      } else {
        apply((d, c) => addTransaction(d, input, c));
        const label = type === 'expense' ? 'Expense added' : type === 'income' ? 'Income added' : 'Transfer added';
        toast({ kind: 'success', title: label, message: `${input.description} · ${f.money(type === 'expense' ? -input.amount : input.amount, currency, { sign: type === 'income' ? 'always' : 'auto' })}` });
        router.replace('/');
      }
    } catch (e) {
      setSaving(false);
      if (e instanceof ValidationError) {
        setErrors(e.errors);
        if (cents === null && amount.trim()) setErrors({ ...e.errors, amount: 'Enter a valid amount' });
      } else toast({ kind: 'error', title: 'Couldn’t save', message: 'Something went wrong. Try again.' });
    }
  };

  const dateLabel = (() => {
    const d = at.slice(0, 10);
    const rel = d === today ? 'Today, ' : d === addDays(today, -1) ? 'Yesterday, ' : '';
    return `${rel}${rel ? f.short(d) : f.date(d)} · ${formatTime(at)}`;
  })();
  const verb = type === 'expense' ? 'expense' : type === 'income' ? 'income' : 'transfer';
  const toAccount = data.accounts.find((a) => a.id === toAccountId);

  return (
    <Screen
      gap="gap-4"
      footer={
        mode === 'edit' ? (
          <>
            <Button variant="secondary" onClick={() => router.back()} className="px-7">
              Cancel
            </Button>
            <Button full loading={saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        ) : (
          <Button full loading={saving} onClick={save}>
            {saving ? 'Saving…' : `Save ${verb}`}
          </Button>
        )
      }
    >
      <header className="flex h-12 items-center justify-between gap-2">
        <IconButton icon="x" label="Close" onClick={() => router.back()} />
        <h1 className="t-title flex-1 text-center">{mode === 'edit' ? 'Edit transaction' : 'Add transaction'}</h1>
        <span className="size-12" aria-hidden />
      </header>

      {isSavingsLinked ? null : (
        <Segmented
          label="Transaction type"
          value={type}
          onChange={changeType}
          options={[
            { id: 'expense', label: 'Expense', icon: 'arrow-up-right' },
            { id: 'income', label: 'Income', icon: 'arrow-down-left' },
            { id: 'transfer', label: 'Transfer', icon: 'arrow-left-right' },
          ]}
        />
      )}

      <div className={cx('flex flex-col items-center gap-2 rounded-[22px] bg-surface px-5 py-5', errors.amount ? 'border-[1.5px] border-error' : 'border border-transparent focus-within:border-ink')}>
        <label htmlFor={ids.amount} className="t-body text-text-secondary">
          Amount
        </label>
        <div className={cx('flex items-baseline justify-center t-display num', !cents && 'text-text-muted')}>
          <span aria-hidden>{symbol}</span>
          <input
            id={ids.amount}
            inputMode="decimal"
            autoComplete="off"
            placeholder={fractionDigits(currency) ? '0.00' : '0'}
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value.replace(/[^\d.,]/g, ''));
              if (errors.amount) setErrors({ ...errors, amount: undefined });
            }}
            aria-invalid={!!errors.amount}
            aria-describedby={`${ids.amount}-m`}
            className="w-full max-w-[220px] bg-transparent text-text outline-none placeholder:text-text-muted"
            style={{ width: `${Math.max(4, amount.length + 0.5)}ch` }}
          />
        </div>
        <div id={`${ids.amount}-m`}>
          {errors.amount ? (
            <p role="alert" className="flex items-center gap-1.5 t-body text-error">
              <Icon name="circle-alert" size={16} />
              {errors.amount}
            </p>
          ) : mode === 'edit' && existing ? (
            <p className="t-caption text-text-muted">
              Added {existing.createdAt.slice(0, 10) === today ? 'today' : f.date(existing.at.slice(0, 10))} at {formatTime(existing.at)}
            </p>
          ) : hint ? (
            <p className={cx('inline-flex items-center gap-1.5 rounded-full px-3 py-1 t-caption-m', hintOver ? 'bg-warning-soft text-warning' : 'bg-surface-muted text-text-secondary')}>
              <Icon name={hintOver ? 'triangle-alert' : 'info'} size={14} />
              {hint}
            </p>
          ) : null}
        </div>
      </div>

      {type !== 'transfer' ? (
        <PickerField
          label="Category"
          placeholder="Choose a category"
          value={category?.name}
          error={errors.categoryId}
          onClick={() => {
            setPendingCat(categoryId);
            setSheet('category');
          }}
          icon={<Icon name={category?.icon ?? 'tag'} size={20} className={errors.categoryId ? 'text-error' : 'text-text'} />}
        />
      ) : null}

      {type !== 'transfer' || !isSavingsLinked ? (
        <Field id={ids.merchant} label={type === 'income' ? 'From' : type === 'transfer' ? 'Description (optional)' : 'Merchant'} icon={type === 'income' ? 'briefcase' : type === 'transfer' ? 'arrow-left-right' : 'shopping-bag'} error={errors.description}>
          <input
            id={ids.merchant}
            value={description}
            maxLength={80}
            onChange={(e) => {
              setDescription(e.target.value);
              if (errors.description) setErrors({ ...errors, description: undefined });
            }}
            placeholder={type === 'income' ? 'e.g. Acme Corp payroll' : type === 'transfer' ? 'Transfer' : 'e.g. Blue Bottle Coffee'}
            className="t-input h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted"
            aria-invalid={!!errors.description}
          />
        </Field>
      ) : null}

      <Field id={ids.date} label="Date & time" icon="calendar" error={errors.at} hint={dateLabel}>
        <input id={ids.date} type="datetime-local" value={at} max={`${addDays(today, 365)}T23:59`} onChange={(e) => setAt(e.target.value.slice(0, 16))} className="t-input h-full min-w-0 flex-1 bg-transparent outline-none" aria-describedby={`${ids.date}-d`} />
        <span id={`${ids.date}-d`} className="sr-only">
          {dateLabel}
        </span>
      </Field>

      <PickerField label={type === 'transfer' ? 'From account' : 'Account'} placeholder="Choose an account" value={account ? accountLabel(account) : undefined} error={errors.accountId} onClick={() => setSheet('account')} icon={<Icon name={account ? accountIcon(account) : 'wallet'} size={20} />} />
      {type === 'transfer' ? (
        <PickerField label="To account" placeholder="Choose an account" value={toAccount ? accountLabel(toAccount) : undefined} error={errors.toAccountId} onClick={() => setSheet('to')} icon={<Icon name={toAccount ? accountIcon(toAccount) : 'wallet'} size={20} />} />
      ) : null}

      <Field id={ids.note} label="Note (optional)" icon="sticky-note" error={errors.note}>
        <input id={ids.note} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" className="t-input h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-muted" />
      </Field>

      <Sheet
        open={sheet === 'category'}
        onClose={() => setSheet(null)}
        title="Select category"
        footer={
          <Button
            full
            disabled={!pendingCat}
            onClick={() => {
              setCategoryId(pendingCat);
              setErrors({ ...errors, categoryId: undefined });
              setSheet(null);
            }}
          >
            {pendingCat ? `Use ${getCategory(pendingCat)?.name}` : 'Choose a category'}
          </Button>
        }
      >
        <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-2 pb-2">
          {cats.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={pendingCat === c.id} onClick={() => setPendingCat(c.id)} className={cx('flex flex-col items-center gap-2 rounded-[18px] py-3', pendingCat === c.id ? 'border-[1.5px] border-ink bg-surface-muted' : 'border-[1.5px] border-transparent')}>
              <span className="relative grid size-14 place-items-center rounded-full" style={{ color: c.color }}>
                <span className="absolute inset-0 rounded-full" style={{ background: c.color, opacity: c.id === 'housing' ? 0.08 : 0.14 }} />
                <Icon name={c.icon} size={24} className="relative" />
              </span>
              <span className="t-label">{c.short}</span>
            </button>
          ))}
        </div>
      </Sheet>

      {(['account', 'to'] as const).map((which) => (
        <Sheet key={which} open={sheet === which} onClose={() => setSheet(null)} title={which === 'to' ? 'To account' : 'Account'}>
          <div className="flex flex-col gap-1" role="listbox" aria-label="Accounts">
            {data.accounts.map((a) => (
              <OptionRow
                key={a.id}
                selected={(which === 'to' ? toAccountId : accountId) === a.id}
                onClick={() => {
                  if (which === 'to') setToAccountId(a.id);
                  else setAccountId(a.id);
                  setErrors({ ...errors, accountId: undefined, toAccountId: undefined });
                  setSheet(null);
                }}
                icon={accountIcon(a)}
                label={accountLabel(a)}
                sub={a.currency}
              />
            ))}
          </div>
        </Sheet>
      ))}
    </Screen>
  );
}

function Field({ id, label, icon, error, children, hint }: { id: string; label: string; icon: string; error?: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="t-label text-text-secondary">
        {label}
      </label>
      <div className={cx('flex h-[54px] items-center gap-2.5 rounded-[16px] bg-surface px-4', error ? 'border-[1.5px] border-error' : 'border border-border focus-within:border-[1.5px] focus-within:border-ink')}>
        <Icon name={icon} size={20} className="shrink-0 text-text" />
        {children}
      </div>
      {error ? (
        <p role="alert" className="flex items-center gap-1.5 t-caption text-error">
          <Icon name="circle-alert" size={14} />
          {error}
        </p>
      ) : hint ? (
        <p className="t-caption text-text-muted" aria-hidden>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
