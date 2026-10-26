'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Suspense, useEffect, type ReactNode } from 'react';

import { StoreProvider, useStore } from '@/state/store';
import { ToastProvider } from './overlays';
import { Spinner } from './Shell';

const OPEN_ROUTES = ['/welcome', '/sign-in'];

/** Waits for IndexedDB, then sends first-time visitors to the welcome screen. */
function Gate({ children }: { children: ReactNode }) {
  const { ready, data } = useStore();
  const path = usePathname();
  const router = useRouter();
  const needsWelcome = ready && !data.settings.onboarded && !OPEN_ROUTES.includes(path);
  useEffect(() => {
    if (needsWelcome) router.replace('/welcome');
  }, [needsWelcome, router]);
  if (!ready || needsWelcome) return <Spinner />;
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <ToastProvider>
        <Suspense fallback={<Spinner />}>
          <Gate>{children}</Gate>
        </Suspense>
      </ToastProvider>
    </StoreProvider>
  );
}
