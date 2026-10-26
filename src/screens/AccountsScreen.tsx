'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Icon } from '@/components/Icon';
import { ConfirmDialog, Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { TransactionRow } from '@/components/TransactionRow';
import { Button, Card, EmptyState, IconButton, InputField, SectionHeader, TopBar, cx } from '@/components/ui';
import { ValidationError, addAccount, deleteAccount, renameAccount, setAccountBalance } from '@/domain/actions';
import { monthAbbr, monthOf, monthRange, inRange } from '@/domain/dates';
import { accountDelta, balances, netWorth } from '@/domain/finance';
import { CURRENCIES, parseAmount, toInput, type CurrencyCode } from '@/domain/money';
import type { AccountType } from '@/domain/types';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { accountIcon } from './TransactionFormScreen';

const TYPE_LABEL: Record<AccountType, string> = { checking: 'Checking', savings: 'Savings', cash: 'Cash', credit: 'Credit' };
const MANUAL_NOTE = 'Accounts and balances are added manually. Montra doesn’t connect to your bank.';

export function AccountsScreen() {
  const { data } = useStore();
  const f = useFormat();
  const router = useRouter();
  const bal = useMemo(() => balances(data), [data]);
  const worth = netWorth(data);
  const lastActivity = (id: string) => data.transactions.filter((t) => t.accountId === id || t.toAccountId === id).reduce((m, t) => (t.at > m ? t.at : m), '');

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full icon="plus" onClick={() => router.push('/accounts/new')}>
          Add account
        </Button>
      }
    >
      <TopBar title="Accounts" back="/" right={<IconButton icon="plus" label="Add account" href="/accounts/new" />} />
      {worth.map((w) => (
        <section key={w.currency} className="flex flex-col gap-3 rounded-[22px] bg-ink p-5 text-on-ink" aria-label={`Net balance ${w.currency}`}>
          <p className="t-body opacity-70">Net balance{worth.length > 1 ? ` · ${w.currency}` : ''}</p>
          <p className="t-balance num">{f.money(w.net, w.currency)}</p>
          <div className="flex gap-6">
            <div>
              <p className="t-caption opacity-70">Assets</p>
              <p className="t-card-title num">{f.money(w.assets, w.currency)}</p>
            </div>
            <div>
              <p className="t-caption opacity-70">Owed</p>
              <p className="t-card-title num text-brand">{f.money(w.owed, w.currency)}</p>
            </div>
          </div>
        </section>
      ))}
      <h2 className="t-section">Your accounts · {data.accounts.length}</h2>
      {data.accounts.length === 0 ? <EmptyState icon="wallet" title="No accounts yet" message="Add an account to start tracking balances." /> : null}
      <ul className="flex flex-col gap-3">
        {data.accounts.map((a) => {
          const b = bal.get(a.id) ?? 0;
          const goals = data.goals.filter((g) => g.accountId === a.id).length;
          const last = lastActivity(a.id);
          const sub = [TYPE_LABEL[a.type], a.mask ? `•• ${a.mask}` : null, goals ? `${goals} goal${goals === 1 ? '' : 's'}` : null, a.dueDate ? `due ${f.short(a.dueDate)}` : null, !a.mask && last ? `updated ${f.short(last.slice(0, 10))}` : null].filter(Boolean).join(' · ');
          return (
            <li key={a.id}>
              <Link href={`/accounts/${a.id}`} className="flex items-center gap-3 rounded-[22px] bg-surface p-4">
                <span className={cx('grid size-12 shrink-0 place-items-center rounded-[14px]', a.type === 'credit' ? 'bg-ink text-on-ink' : 'bg-surface-muted')}>
                  <Icon name={accountIcon(a)} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="t-item truncate">{a.name}</p>
                  <p className="t-caption truncate text-text-muted">{sub}</p>
                </div>
                <span className={cx('t-amount-s num', b < 0 && 'text-error')}>{f.money(b, a.currency)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="flex gap-2.5 rounded-[16px] bg-surface-muted p-3 t-caption text-text-secondary">
        <Icon name="info" size={18} className="shrink-0" />
        {MANUAL_NOTE}
      </p>
    </Screen>
  );
}

export function AccountDetailScreen() {
  const { data, today, set } = useStore();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const a = data.accounts.find((x) => x.id === id);
  const accounts = useMemo(() => new Map(data.accounts.map((x) => [x.id, x])), [data.accounts]);
  const [sheet, setSheet] = useState<'balance' | 'edit' | null>(null);
  const [value, setValue] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);

  if (!a)
    return (
      <Screen>
        <TopBar title="Account" back="/accounts" />
        <EmptyState icon="wallet" title="Account not found" message="It may have been deleted." action={<Button onClick={() => router.push('/accounts')}>Back to accounts</Button>} />
      </Screen>
    );

  const bal = balances(data).get(a.id) ?? 0;
  const mine = data.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const range = monthRange(monthOf(today));
  let moneyIn = 0;
  let moneyOut = 0;
  for (const t of mine) {
    if (!inRange(t.at, range)) continue;
    const d = accountDelta(t, a.id);
    if (d > 0) moneyIn += d;
    else moneyOut -= d;
  }
  const last = mine[0]?.at;
  const m = monthAbbr(monthOf(today));
  const deletable = !mine.length && !data.goals.some((g) => g.accountId === a.id);

  const saveBalance = () => {
    const c = value.trim().startsWith('-') ? -(parseAmount(value.replace('-', ''), a.currency) ?? NaN) : parseAmount(value, a.currency);
    if (c === null || Number.isNaN(c)) return setError('Enter a valid balance');
    set((d, cx) => setAccountBalance(d, a.id, c, bal, cx));
    setSheet(null);
    toast({ kind: 'success', title: 'Balance updated', message: `${a.name} · ${f.money(c, a.currency)}` });
  };
  const saveName = () => {
    try {
      set((d, c) => renameAccount(d, a.id, name, c));
      setSheet(null);
      toast({ kind: 'success', title: 'Account renamed', message: name.trim() });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Couldn’t rename');
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <>
          <Button variant="secondary" icon="pencil" onClick={() => (setValue(toInput(bal, a.currency)), setError(undefined), setSheet('balance'))} className="flex-1 px-4">
            Update balance
          </Button>
          <Button icon="plus" onClick={() => router.push('/transactions/new')} className="flex-1 px-4">
            Add transaction
          </Button>
        </>
      }
    >
      <TopBar title={a.name} back="/accounts" right={<IconButton icon="pencil" label="Edit account" onClick={() => (setName(a.name), setError(undefined), setSheet('edit'))} />} />
      <section className="flex flex-col gap-2 rounded-[22px] bg-ink p-5 text-on-ink" aria-label="Current balance">
        <div className="flex items-center justify-between gap-2">
          <span className="t-body opacity-70">Current balance</span>
          <span className="rounded-full bg-brand px-3 py-1 t-label text-on-brand">
            {TYPE_LABEL[a.type]}
            {a.mask ? ` · •• ${a.mask}` : ''}
          </span>
        </div>
        <p className="t-balance num">{f.money(bal, a.currency)}</p>
        <p className="t-caption opacity-70">{last ? `Last activity · ${f.short(last.slice(0, 10))}` : 'No activity yet'}</p>
      </section>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="t-caption text-text-muted">Money in · {m}</p>
          <p className="t-card-title num">{f.money(moneyIn, a.currency)}</p>
        </Card>
        <Card className="p-4">
          <p className="t-caption text-text-muted">Money out · {m}</p>
          <p className="t-card-title num">{f.money(moneyOut, a.currency)}</p>
        </Card>
      </div>
      <SectionHeader title="Recent in this account" href="/transactions" />
      {mine.length ? (
        <Card className="divide-y divide-divider overflow-hidden">
          {mine.slice(0, 8).map((t) => (
            <TransactionRow key={t.id} t={t} accounts={accounts} perspective={a.id} />
          ))}
        </Card>
      ) : (
        <Card className="p-5 t-body text-text-secondary">No transactions in this account yet.</Card>
      )}

      <Sheet open={sheet === 'balance'} onClose={() => setSheet(null)} title="Update balance" footer={<Button full onClick={saveBalance}>Save balance</Button>}>
        <div className="flex flex-col gap-3">
          <InputField label={`Current balance (${a.currency})`} icon="dollar" inputMode="decimal" value={value} onChange={(e) => (setValue(e.target.value.replace(/[^\d.,-]/g, '')), setError(undefined))} error={error} helper={a.type === 'credit' ? 'Use a minus sign for money owed, e.g. -1248.30' : undefined} />
          <p className="t-caption text-text-muted">The difference adjusts the starting balance, so it won’t show up as income or spending in reports.</p>
        </div>
      </Sheet>
      <Sheet
        open={sheet === 'edit'}
        onClose={() => setSheet(null)}
        title="Edit account"
        footer={
          <Button full onClick={saveName}>
            Save
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <InputField label="Account name" icon="tag" value={name} maxLength={40} onChange={(e) => (setName(e.target.value), setError(undefined))} error={error} />
          <button type="button" onClick={() => (deletable ? (setSheet(null), setConfirm(true)) : setError('Accounts with transactions or savings goals can’t be deleted'))} className="flex h-12 items-center justify-center gap-2 rounded-full bg-error-soft t-button-s text-error">
            <Icon name="trash" size={18} />
            Delete account
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm}
        title="Delete this account?"
        message={`${a.name} has no transactions and will be removed.`}
        confirmLabel="Delete account"
        onCancel={() => setConfirm(false)}
        onConfirm={() => {
          set((d) => deleteAccount(d, a.id));
          toast({ kind: 'info', title: 'Account deleted', message: a.name });
          router.replace('/accounts');
        }}
      />
    </Screen>
  );
}

export function AccountFormScreen() {
  const { data, apply } = useStore();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const [type, setType] = useState<AccountType>('checking');
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [mask, setMask] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>(data.settings.defaultCurrency);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const save = () => {
    const c = balance.trim() ? parseAmount(balance, currency) : 0;
    if (c === null) return setErrors({ openingBalance: 'Enter a valid balance' });
    try {
      const { account } = apply((d, cx) => addAccount(d, { name, type, currency, openingBalance: type === 'credit' ? -c : c, mask }, cx));
      toast({ kind: 'success', title: 'Account added', message: `${account.name} · ${f.money(account.openingBalance, currency)}` });
      router.replace('/accounts');
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors);
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full onClick={save}>
          Add account
        </Button>
      }
    >
      <header className="flex h-12 items-center justify-between gap-2">
        <IconButton icon="x" label="Close" onClick={() => router.back()} />
        <h1 className="t-title flex-1 text-center">Add account</h1>
        <span className="size-12" aria-hidden />
      </header>
      <div className="flex flex-col gap-2">
        <span id="type-l" className="t-label text-text-secondary">
          Account type
        </span>
        <div role="radiogroup" aria-labelledby="type-l" className="grid grid-cols-4 gap-2">
          {(Object.keys(TYPE_LABEL) as AccountType[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cx('flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-[18px] t-label', type === t ? 'bg-ink text-on-ink' : 'border border-border bg-surface')}>
              <Icon name={accountIcon({ type: t })} size={22} />
              {TYPE_LABEL[t]}
            </button>
          ))}
        </div>
      </div>
      <InputField label="Account name" icon="tag" value={name} maxLength={40} placeholder="e.g. Travel Savings" onChange={(e) => (setName(e.target.value), setErrors({ ...errors, name: undefined }))} error={errors.name} />
      <InputField
        label={type === 'credit' ? 'Amount owed now' : 'Starting balance'}
        icon="dollar"
        inputMode="decimal"
        placeholder="0.00"
        value={balance}
        onChange={(e) => (setBalance(e.target.value.replace(/[^\d.,]/g, '')), setErrors({ ...errors, openingBalance: undefined }))}
        error={errors.openingBalance}
        helper={type === 'credit' ? 'Shown as a negative balance (money owed).' : undefined}
      />
      <InputField label="Last 4 digits (optional)" icon="lock" inputMode="numeric" maxLength={4} placeholder="e.g. 1234" value={mask} onChange={(e) => setMask(e.target.value.replace(/\D/g, ''))} helper="Only used to tell your accounts apart" />
      <div className="flex flex-col gap-2">
        <span className="t-label text-text-secondary">Currency</span>
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {CURRENCIES.map((c) => (
            <button key={c.code} type="button" aria-pressed={currency === c.code} onClick={() => setCurrency(c.code)} className={cx('h-10 shrink-0 rounded-full px-4 t-label', currency === c.code ? 'bg-ink text-on-ink' : 'border border-border bg-surface')}>
              {c.code}
            </button>
          ))}
        </div>
      </div>
      <p className="flex gap-2.5 rounded-[16px] bg-surface-muted p-3 t-caption text-text-secondary">
        <Icon name="info" size={18} className="shrink-0" />
        Accounts are tracked manually. You can update the balance anytime.
      </p>
    </Screen>
  );
}
