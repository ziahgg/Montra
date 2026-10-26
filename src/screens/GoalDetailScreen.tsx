'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { Ring } from '@/components/charts';
import { Icon } from '@/components/Icon';
import { Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, Card, EmptyState, IconButton, PickerField, TopBar, cx } from '@/components/ui';
import { ValidationError, addContribution } from '@/domain/actions';
import { formatMonthShort, monthOf } from '@/domain/dates';
import { balances, goalProgress } from '@/domain/finance';
import { CURRENCIES, parseAmount, toInput } from '@/domain/money';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';
import { OptionRow } from './TransactionsScreen';
import { accountIcon, accountLabel } from './TransactionFormScreen';

const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));

export function GoalDetailScreen() {
  const { data, today, apply, ctx } = useStore();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const f = useFormat();
  const [open, setOpen] = useState(false);
  const goal = data.goals.find((g) => g.id === id);
  const sources = data.accounts.filter((a) => a.id !== goal?.accountId && a.currency === goal?.currency);
  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState(sources.find((a) => a.type === 'checking')?.id ?? sources[0]?.id ?? '');
  const [pickFrom, setPickFrom] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!goal)
    return (
      <Screen>
        <TopBar title="Goal" back="/savings" />
        <EmptyState icon="piggy-bank" title="Goal not found" message="It may have been deleted." action={<Button onClick={() => router.push('/savings')}>Back to savings</Button>} />
      </Screen>
    );

  const p = goalProgress(goal, data.transactions, today);
  const money = (c: number, whole?: boolean) => f.money(c, goal.currency, { whole });
  const symbol = CURRENCIES.find((c) => c.code === goal.currency)?.symbol ?? '';
  const targetMonth = monthOf(goal.targetDate);
  const late = p.projected ? monthsBetween(targetMonth, p.projected) : 0;
  const bal = balances(data);
  const cents = parseAmount(amount, goal.currency);
  const from = data.accounts.find((a) => a.id === fromId);
  const chronological = [...p.contributions].reverse();
  const running = new Map<string, number>();
  chronological.reduce((s, t) => (running.set(t.id, s + t.amount), s + t.amount), 0);
  const presets = [10000, 30000, goal.monthlyPlan, 100000].filter((v, i, a) => v > 0 && a.indexOf(v) === i).sort((a, b) => a - b);

  const openSheet = () => {
    setAmount(goal.monthlyPlan ? toInput(Math.min(goal.monthlyPlan, p.remaining), goal.currency) : '');
    setError(null);
    setOpen(true);
  };
  const submit = () => {
    try {
      const amt = cents ?? 0;
      apply((d, c) => addContribution(d, goal.id, { amount: amt, fromAccountId: fromId, at: ctx().now, note: '' }, c));
      setOpen(false);
      const after = p.saved + amt;
      toast({ kind: 'success', title: 'Contribution added', message: `${money(amt)} · ${goal.name} now ${Math.floor((after / goal.target) * 100)}%` });
    } catch (e) {
      setError(e instanceof ValidationError ? e.message : 'Couldn’t add this contribution');
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <>
          <Button variant="secondary" icon="pencil" onClick={() => router.push(`/savings/${goal.id}/edit`)} className="px-6">
            Edit
          </Button>
          <Button full icon="plus" onClick={openSheet} disabled={p.complete}>
            {p.complete ? 'Goal reached' : 'Add contribution'}
          </Button>
        </>
      }
    >
      <TopBar title={goal.name} back="/savings" right={<IconButton icon="pencil" label="Edit goal" href={`/savings/${goal.id}/edit`} />} />
      <Card className="flex flex-col items-center gap-2 p-5 text-center">
        <Ring value={p.progress} label={`${Math.floor(p.progress * 100)}% saved`}>
          <span className="t-amount-l num">{Math.floor(p.progress * 100)}%</span>
          <span className="t-caption text-text-muted">saved</span>
        </Ring>
        <p className="t-amount-m num mt-2">{money(p.saved)}</p>
        <p className="t-body text-text-muted">
          of {money(goal.target)} · target {formatMonthShort(targetMonth)}
        </p>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        <Card className="p-4">
          <p className="t-caption text-text-muted">Remaining</p>
          <p className="t-card-title num">{money(p.remaining)}</p>
        </Card>
        <Card className="p-4">
          <p className="t-caption text-text-muted">Monthly plan</p>
          <p className="t-card-title num">{goal.monthlyPlan ? money(goal.monthlyPlan) : 'Not set'}</p>
        </Card>
      </div>
      {!p.complete && p.projected ? (
        <div className={cx('flex gap-2.5 rounded-[16px] p-4 t-body', late > 0 ? 'bg-warning-soft' : 'bg-income-soft')}>
          <Icon name="clock" size={20} className={late > 0 ? 'shrink-0 text-warning' : 'shrink-0 text-income'} />
          <p>
            At {money(goal.monthlyPlan, true)}/month you’ll reach this goal in {formatMonthShort(p.projected)}
            {late > 0 ? ` — ${late} month${late === 1 ? '' : 's'} after your target.` : late < 0 ? ` — ${-late} month${late === -1 ? '' : 's'} early.` : ' — right on target.'}
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="contrib">
        <h2 id="contrib" className="t-section">
          Contributions
        </h2>
        {p.contributions.length ? (
          <Card className="divide-y divide-divider overflow-hidden">
            {p.contributions.map((t) => {
              const src = data.accounts.find((a) => a.id === t.accountId);
              return (
                <Link key={t.id} href={`/transactions/${t.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full bg-savings-soft text-savings">
                    <Icon name="piggy-bank" size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="t-item truncate">{t.description === 'Contribution' ? 'Monthly contribution' : t.description}</p>
                    <p className="t-caption truncate text-text-muted">
                      {f.date(t.at.slice(0, 10))} · from {src?.name.replace('Everyday ', '') ?? 'deleted account'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="t-amount-s num">{f.money(t.amount, t.currency, { sign: 'always' })}</p>
                    <p className="t-caption text-text-muted">Total {money(running.get(t.id) ?? 0, true)}</p>
                  </div>
                </Link>
              );
            })}
          </Card>
        ) : (
          <Card className="p-5 t-body text-text-secondary">No contributions yet.</Card>
        )}
      </section>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Add contribution"
        footer={
          <Button full onClick={submit} disabled={!cents}>
            {cents ? `Add ${money(cents)}` : 'Add contribution'}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-center gap-1">
            <label htmlFor="contrib-amt" className="t-body text-text-secondary">
              Amount
            </label>
            <div className={cx('flex items-baseline t-display num', !cents && 'text-text-muted')}>
              <span aria-hidden>{symbol}</span>
              <input
                id="contrib-amt"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => (setAmount(e.target.value.replace(/[^\d.,]/g, '')), setError(null))}
                aria-invalid={!!error}
                className="bg-transparent text-text outline-none"
                style={{ width: `${Math.max(4, amount.length + 0.5)}ch` }}
              />
            </div>
            {error ? (
              <p role="alert" className="flex items-center gap-1.5 t-body text-error">
                <Icon name="circle-alert" size={16} />
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex justify-center gap-2">
            {presets.map((v) => (
              <button key={v} type="button" aria-pressed={cents === v} onClick={() => (setAmount(toInput(v, goal.currency)), setError(null))} className={cx('h-10 rounded-full px-4 t-label', cents === v ? 'bg-ink text-on-ink' : 'border border-border')}>
                {money(v, true)}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <PickerField label="From account" placeholder="Choose an account" value={from ? accountLabel(from) : undefined} onClick={() => setPickFrom(true)} icon={<Icon name={from ? accountIcon(from) : 'wallet'} size={20} />} />
            {from ? <p className="t-caption text-text-muted">Available {f.money(bal.get(from.id) ?? 0, from.currency)}</p> : null}
            {from && from.type !== 'credit' && cents && cents > (bal.get(from.id) ?? 0) ? <p className="t-caption text-warning">This is more than the account’s current balance.</p> : null}
          </div>
          {cents ? (
            <div className="flex items-center justify-between rounded-[14px] bg-savings-soft px-4 py-3">
              <span className="t-body text-text-secondary">New total</span>
              <span className="t-body-m num text-savings">
                {money(p.saved + cents)} · {Math.floor(((p.saved + cents) / goal.target) * 100)}%
              </span>
            </div>
          ) : null}
        </div>
      </Sheet>
      <Sheet open={pickFrom} onClose={() => setPickFrom(false)} title="From account">
        <div className="flex flex-col gap-1">
          {sources.map((a) => (
            <OptionRow key={a.id} selected={a.id === fromId} onClick={() => (setFromId(a.id), setPickFrom(false))} icon={accountIcon(a)} label={accountLabel(a)} sub={f.money(bal.get(a.id) ?? 0, a.currency)} />
          ))}
        </div>
      </Sheet>
    </Screen>
  );
}
