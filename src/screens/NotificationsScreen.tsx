'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Icon } from '@/components/Icon';
import { Screen } from '@/components/Shell';
import { Button, Card, EmptyState, FilterChip, IconButton, TopBar, cx } from '@/components/ui';
import { markAllRead, markRead } from '@/domain/actions';
import { addDays, formatTime } from '@/domain/dates';
import type { AppNotification, NotificationType } from '@/domain/types';
import { useFormat } from '@/state/format';
import { useStore } from '@/state/store';

const STYLE: Record<NotificationType, { icon: string; cls: string }> = {
  budget: { icon: 'triangle-alert', cls: 'bg-warning-soft text-warning' },
  bill: { icon: 'calendar', cls: 'bg-info-soft text-info' },
  goal: { icon: 'target', cls: 'bg-savings-soft text-savings' },
  transaction: { icon: 'circle-check', cls: 'bg-income-soft text-income' },
};

export function NotificationsScreen() {
  const { data, today, set } = useStore();
  const router = useRouter();
  const f = useFormat();
  const [filter, setFilter] = useState<'all' | 'budget' | 'bill' | 'goal'>('all');
  const list = [...data.notifications].filter((n) => filter === 'all' || n.type === filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const weekAgo = addDays(today, -6);
  const groups = [
    { label: 'Today', items: list.filter((n) => n.createdAt.slice(0, 10) === today) },
    { label: 'This week', items: list.filter((n) => n.createdAt.slice(0, 10) < today && n.createdAt.slice(0, 10) >= weekAgo) },
    { label: 'Earlier', items: list.filter((n) => n.createdAt.slice(0, 10) < weekAgo) },
  ].filter((g) => g.items.length);
  const unread = data.notifications.some((n) => !n.read);

  const open = (n: AppNotification) => {
    set((d) => markRead(d, n.id));
    if (!n.ref) return;
    const path = { transaction: '/transactions/', budget: '/budgets/', goal: '/savings/', account: '/accounts/' }[n.ref.kind];
    router.push(path + n.ref.id);
  };

  return (
    <Screen gap="gap-4">
      <TopBar title="Notifications" back="/" right={<IconButton icon="sliders" label="Notification settings" href="/profile#preferences" />} />
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {(
          [
            ['all', 'All'],
            ['budget', 'Budgets'],
            ['bill', 'Bills'],
            ['goal', 'Goals'],
          ] as const
        ).map(([id, label]) => (
          <FilterChip key={id} selected={filter === id} onClick={() => setFilter(id)}>
            {label}
          </FilterChip>
        ))}
      </div>
      {unread ? (
        <Button variant="ghost" size="sm" icon="check" className="self-end" onClick={() => set((d) => markAllRead(d))}>
          Mark all as read
        </Button>
      ) : null}
      {groups.length === 0 ? <EmptyState icon="bell" title="You’re all caught up" message="Budget alerts, bill reminders and goal milestones will appear here." /> : null}
      {groups.map((g) => (
        <section key={g.label} className="flex flex-col gap-2" aria-label={g.label}>
          <h2 className="t-body-m text-text-secondary">{g.label}</h2>
          <Card className="divide-y divide-divider overflow-hidden">
            {g.items.map((n) => {
              const s = STYLE[n.type];
              const day = n.createdAt.slice(0, 10);
              return (
                <button key={n.id} type="button" onClick={() => open(n)} className={cx('flex w-full items-start gap-3 px-4 py-3.5 text-left', !n.read && n.type === 'budget' ? 'bg-brand-soft' : !n.read && 'bg-surface-muted')}>
                  <span className={cx('grid size-11 shrink-0 place-items-center rounded-full', s.cls)}>
                    <Icon name={s.icon} size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="t-item block">{n.title}</span>
                    <span className="t-body block text-text-secondary">{n.message}</span>
                    <span className="t-caption block text-text-muted">
                      {day === today ? formatTime(n.createdAt) : f.day(day)}
                      {n.read ? '' : ' · Unread'}
                    </span>
                  </span>
                </button>
              );
            })}
          </Card>
        </section>
      ))}
    </Screen>
  );
}
