import { Suspense } from 'react';

import { Spinner } from '@/components/Shell';
import { NotificationsScreen } from '@/screens/NotificationsScreen';

// Client-rendered from IndexedDB behind the loading gate; see layout.tsx.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <NotificationsScreen />
    </Suspense>
  );
}
