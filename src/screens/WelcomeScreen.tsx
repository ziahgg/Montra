'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Shell';
import { Button, InputField, TopBar, cx } from '@/components/ui';
import { ValidationError, updateSettings } from '@/domain/actions';
import { goalProgress, netWorth, periodTotals } from '@/domain/finance';
import { monthName, monthOf, monthRange } from '@/domain/dates';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

const SLIDES = [
  { title: 'Personal finance, made calm.', body: 'See where your money goes, set budgets that fit, and save for what matters — all in one place.' },
  { title: 'Budgets that warn you early.', body: 'Montra flags a category at 80% so you can adjust before you go over.' },
  { title: 'Your data stays on this device.', body: 'Everything is stored locally in this browser. Nothing is sent to a server or connected to your bank.' },
];

export function WelcomeScreen() {
  const { data, today, set } = useStore();
  const router = useRouter();
  const f = useFormat();
  const [slide, setSlide] = useState(0);
  const cur = data.settings.defaultCurrency;
  const worth = netWorth(data).find((w) => w.currency === cur)?.net ?? 0;
  const spent = periodTotals(data.transactions, monthRange(monthOf(today)), cur).expenses;
  const goal = data.goals[0];
  const gp = goal ? goalProgress(goal, data.transactions, today) : null;
  const s = SLIDES[slide];

  const start = () => {
    set((d) => updateSettings(d, { onboarded: true }));
    router.replace('/');
  };

  return (
    <Screen gap="gap-5" className="min-h-dvh">
      <div className="relative h-[440px] overflow-hidden rounded-[28px] bg-ink" aria-hidden>
        <div className="absolute left-7 top-14 w-[66%] rounded-[20px] bg-surface p-4">
          <p className="t-caption text-text-muted">Total balance</p>
          <p className="t-amount-m num">{f.money(worth, cur)}</p>
          <div className="mt-2 h-1.5 rounded-full bg-surface-muted">
            <div className="h-full w-1/2 rounded-full bg-brand" />
          </div>
        </div>
        <div className="absolute right-7 top-[190px] w-[60%] rounded-[20px] bg-surface p-4">
          <p className="t-caption text-text-muted">{monthName(monthOf(today))} spending</p>
          <p className="t-amount-m num">{f.money(-spent, cur)}</p>
        </div>
        {goal && gp ? (
          <div className="absolute left-10 top-[320px] w-[55%] rounded-[20px] bg-surface p-4">
            <p className="t-caption text-text-muted">{goal.name}</p>
            <p className="t-amount-m text-savings">{Math.floor(gp.progress * 100)}% saved</p>
          </div>
        ) : null}
        <span className="absolute bottom-14 right-8 grid size-14 place-items-center rounded-full bg-brand text-on-brand">
          <Icon name="coins" size={26} />
        </span>
      </div>
      <div className="flex flex-col gap-3" aria-live="polite">
        <h1 className="t-page">{s.title}</h1>
        <p className="t-body text-text-secondary">{s.body}</p>
      </div>
      <div className="flex gap-1.5" role="tablist" aria-label="Intro slides">
        {SLIDES.map((x, i) => (
          <button key={x.title} type="button" role="tab" aria-selected={i === slide} aria-label={`Slide ${i + 1}`} onClick={() => setSlide(i)} className={cx('h-2 rounded-full', i === slide ? 'w-6 bg-ink' : 'w-2 bg-disabled')} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-3">
        <Button full onClick={slide < SLIDES.length - 1 ? () => setSlide(slide + 1) : start}>
          {slide < SLIDES.length - 1 ? 'Get started' : 'Start with sample data'}
        </Button>
        <Button full variant="secondary" onClick={() => router.push('/sign-in')}>
          I already have an account
        </Button>
      </div>
    </Screen>
  );
}

/**
 * Montra has no server or real accounts. "Sign in" just sets the local profile
 * name and email on this device — no password is collected or checked.
 */
export function SignInScreen() {
  const { data, set } = useStore();
  const router = useRouter();
  const [name, setName] = useState(data.settings.name);
  const [email, setEmail] = useState(data.settings.email);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const go = () => {
    try {
      set((d) => updateSettings(d, { name, email, onboarded: true }));
      router.replace('/');
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors);
    }
  };

  return (
    <Screen
      gap="gap-4"
      footer={
        <Button full onClick={go}>
          Continue
        </Button>
      }
    >
      <TopBar title="" back="/welcome" />
      <h1 className="t-page">Welcome back</h1>
      <p className="t-body text-text-secondary">Continue with your local profile on this device.</p>
      <InputField label="Name" icon="user" value={name} onChange={(e) => (setName(e.target.value), setErrors({}))} error={errors.name} autoComplete="name" />
      <InputField label="Email (optional)" icon="mail" type="email" value={email} onChange={(e) => (setEmail(e.target.value), setErrors({}))} error={errors.email} autoComplete="email" />
      <p className="flex gap-2.5 rounded-[16px] bg-surface-muted p-3 t-caption text-text-secondary">
        <Icon name="info" size={18} className="shrink-0" />
        Montra doesn’t have online accounts yet. Your data lives only in this browser, so there’s no password and nothing is synced.
      </p>
    </Screen>
  );
}
