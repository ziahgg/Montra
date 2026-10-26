'use client';

import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { ConfirmDialog, Sheet, useToast } from '@/components/overlays';
import { Screen } from '@/components/Shell';
import { Button, Card, IconButton, InputField, ListRow, PageHeader, Tag, Toggle } from '@/components/ui';
import { ValidationError, updateSettings } from '@/domain/actions';
import { CURRENCIES } from '@/domain/money';
import { useStore } from '@/state/store';
import { OptionRow } from './TransactionsScreen';

export function ProfileScreen() {
  const { data, set, resetSampleData, saveError } = useStore();
  const router = useRouter();
  const toast = useToast();
  const s = data.settings;
  const [sheet, setSheet] = useState<'profile' | 'currency' | 'language' | 'date' | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'signout' | null>(null);
  const [name, setName] = useState(s.name);
  const [email, setEmail] = useState(s.email);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const cur = CURRENCIES.find((c) => c.code === s.defaultCurrency);
  const activeGoals = data.goals.filter((g) => g.status === 'active').length;
  const unread = data.notifications.filter((n) => !n.read).length;
  const initials = s.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const saveProfile = () => {
    try {
      set((d) => updateSettings(d, { name, email }));
      setSheet(null);
      toast({ kind: 'success', title: 'Profile updated' });
    } catch (e) {
      if (e instanceof ValidationError) setErrors(e.errors);
    }
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `montra-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ kind: 'success', title: 'Export ready', message: 'Your data was saved as a JSON file.' });
  };

  return (
    <Screen nav gap="gap-4">
      <PageHeader title="Profile" />
      <Card className="flex items-center gap-3 p-4">
        <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand t-title text-on-brand" aria-hidden>
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-section truncate">{s.name}</p>
          <p className="t-caption truncate text-text-muted">{s.email || 'No email set'}</p>
        </div>
        <IconButton icon="pencil" label="Edit profile" look="muted" size="md" onClick={() => (setName(s.name), setEmail(s.email), setErrors({}), setSheet('profile'))} />
      </Card>
      {saveError ? <p className="rounded-[16px] bg-error-soft p-3 t-body">Changes couldn’t be saved to this browser’s storage. They’ll be lost when you close the tab.</p> : null}

      <Group title="Money">
        <ListRow icon="wallet" label="Accounts" value={String(data.accounts.length)} href="/accounts" />
        <ListRow icon="piggy-bank" label="Savings goals" value={`${activeGoals} active`} href="/savings" />
        <ListRow icon="bell" label="Notifications" value={unread ? `${unread} new` : 'None new'} href="/notifications" />
      </Group>

      <Group title="Preferences" id="preferences">
        <ListRow icon="dollar" label="Currency" value={`${s.defaultCurrency} (${cur?.symbol ?? ''})`} onClick={() => setSheet('currency')} />
        <ListRow icon="calendar" label="Date format" value={s.dateStyle === 'us' ? 'Oct 26, 2026' : '26 Oct 2026'} onClick={() => setSheet('date')} />
        <ListRow icon="languages" label="Language" value="English" onClick={() => setSheet('language')} />
        <ListRow icon="bell" label="Budget alerts" trailing={<Toggle checked={s.budgetAlerts} onChange={(v) => set((d) => updateSettings(d, { budgetAlerts: v }))} label="Budget alerts" />} />
        <ListRow icon="moon" label="Dark mode" trailing={<Toggle checked={s.theme === 'dark'} onChange={(v) => set((d) => updateSettings(d, { theme: v ? 'dark' : 'light' }))} label="Dark mode" />} />
      </Group>

      <Group title="Security & data">
        <ListRow icon="lock" label="App passcode" trailing={<Tag>Not available</Tag>} />
        <ListRow icon="scan-face" label="Face ID" trailing={<Tag>Coming soon</Tag>} />
        <ListRow icon="download" label="Export data (JSON)" onClick={exportData} />
        <ListRow icon="rotate-ccw" label="Reset sample data" onClick={() => setConfirm('reset')} />
        <ListRow icon="log-out" label="Sign out" danger onClick={() => setConfirm('signout')} />
      </Group>
      <p className="px-1 t-caption text-text-muted">Montra stores everything in this browser (IndexedDB). There is no server, sync or encryption.</p>

      <Sheet open={sheet === 'profile'} onClose={() => setSheet(null)} title="Edit profile" footer={<Button full onClick={saveProfile}>Save</Button>}>
        <div className="flex flex-col gap-4">
          <InputField label="Name" icon="user" value={name} onChange={(e) => (setName(e.target.value), setErrors({}))} error={errors.name} />
          <InputField label="Email" icon="mail" type="email" value={email} onChange={(e) => (setEmail(e.target.value), setErrors({}))} error={errors.email} />
        </div>
      </Sheet>
      <Sheet open={sheet === 'currency'} onClose={() => setSheet(null)} title="Default currency">
        <div className="flex flex-col gap-1">
          {CURRENCIES.map((c) => (
            <OptionRow key={c.code} selected={c.code === s.defaultCurrency} onClick={() => (set((d) => updateSettings(d, { defaultCurrency: c.code })), setSheet(null))} icon="dollar" label={`${c.label}`} sub={`${c.code} (${c.symbol})`} />
          ))}
          <p className="px-3 pt-2 t-caption text-text-muted">Used for new budgets and the summaries. Amounts are never converted between currencies.</p>
        </div>
      </Sheet>
      <Sheet open={sheet === 'date'} onClose={() => setSheet(null)} title="Date format">
        <div className="flex flex-col gap-1">
          <OptionRow selected={s.dateStyle === 'us'} onClick={() => (set((d) => updateSettings(d, { dateStyle: 'us' })), setSheet(null))} icon="calendar" label="Oct 26, 2026" sub="Month first" />
          <OptionRow selected={s.dateStyle === 'intl'} onClick={() => (set((d) => updateSettings(d, { dateStyle: 'intl' })), setSheet(null))} icon="calendar" label="26 Oct 2026" sub="Day first" />
        </div>
      </Sheet>
      <Sheet open={sheet === 'language'} onClose={() => setSheet(null)} title="Language">
        <div className="flex flex-col gap-1">
          <OptionRow selected onClick={() => setSheet(null)} icon="languages" label="English" />
          <p className="px-3 pt-2 t-caption text-text-muted">Other languages aren’t available yet.</p>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirm === 'reset'}
        icon="rotate-ccw"
        title="Reset sample data?"
        message="All your transactions, accounts, budgets and goals in this browser are replaced with the October 2026 sample data."
        confirmLabel="Reset data"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          void resetSampleData();
          setConfirm(null);
          toast({ kind: 'info', title: 'Sample data restored' });
        }}
      />
      <ConfirmDialog
        open={confirm === 'signout'}
        icon="log-out"
        title="Sign out?"
        message="Your data stays in this browser. You’ll see the welcome screen next time."
        confirmLabel="Sign out"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          set((d) => updateSettings(d, { onboarded: false }));
          setConfirm(null);
          router.replace('/welcome');
        }}
      />
    </Screen>
  );
}

function Group({ title, id, children }: { title: string; id?: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-2" aria-label={title}>
      <h2 className="px-1 t-body text-text-secondary">{title}</h2>
      <Card className="divide-y divide-divider overflow-hidden">{children}</Card>
    </section>
  );
}
