'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { Icon } from './Icon';
import { cx } from './ui';

const TABS = [
  { href: '/', label: 'Home', icon: 'house', match: (p: string) => p === '/' || p.startsWith('/accounts') || p.startsWith('/savings') || p.startsWith('/notifications') },
  { href: '/transactions', label: 'Transactions', icon: 'receipt-text', match: (p: string) => p.startsWith('/transactions') },
  { href: '/budgets', label: 'Budgets', icon: 'chart-pie', match: (p: string) => p.startsWith('/budgets') },
  { href: '/reports', label: 'Reports', icon: 'chart-column', match: (p: string) => p.startsWith('/reports') },
  { href: '/profile', label: 'Profile', icon: 'user', match: (p: string) => p.startsWith('/profile') },
];

/** Figma "Bottom Navigation": floating white pill; the active item expands into an ink pill with its label. */
export function BottomNav() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="pointer-events-none fixed inset-x-0 bottom-[max(14px,env(safe-area-inset-bottom))] z-40 flex justify-center px-4">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface p-[5px] shadow-[var(--nav-shadow)]">
        {TABS.map((t) => {
          const on = t.match(path);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-label={t.label}
                aria-current={on ? 'page' : undefined}
                className={cx('flex h-12 items-center rounded-full', on ? 'gap-2 bg-ink pr-[18px] pl-4 text-on-ink' : 'w-12 justify-center bg-surface-muted text-text')}
              >
                <Icon name={t.icon} size={on ? 20 : 21} />
                {on ? <span className="t-nav">{t.label}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Mobile-first screen frame: 390-px design column centred on larger screens,
 * 20 px gutters, safe-area padding, and room for the floating nav or a sticky footer.
 */
export function Screen({ children, nav, footer, gap = 'gap-6', className }: { children: ReactNode; nav?: boolean; footer?: ReactNode; gap?: string; className?: string }) {
  return (
    <>
      <main className={cx('mx-auto flex w-full max-w-[430px] flex-col px-5 pt-[max(16px,env(safe-area-inset-top))]', gap, nav ? 'pb-32' : footer ? 'pb-36' : 'pb-10', className)}>{children}</main>
      {footer ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex justify-center bg-gradient-to-t from-bg from-60% to-transparent px-5 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="flex w-full max-w-[390px] gap-3">{footer}</div>
        </div>
      ) : null}
      {nav ? <BottomNav /> : null}
    </>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-[60dvh] items-center justify-center">
      <span className="size-6 rounded-full border-2 border-ink border-t-transparent anim-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  );
}
