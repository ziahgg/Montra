import { Suspense } from 'react';

import { Spinner } from '@/components/Shell';
import { TransactionsScreen } from '@/screens/TransactionsScreen';

// Client-rendered from IndexedDB behind the loading gate; see layout.tsx.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <TransactionsScreen />
    </Suspense>
  );
}
