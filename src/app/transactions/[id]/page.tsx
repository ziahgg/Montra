import { Suspense } from 'react';

import { Spinner } from '@/components/Shell';
import { TransactionDetailScreen } from '@/screens/TransactionDetailScreen';

// Client-rendered from IndexedDB behind the loading gate; see layout.tsx.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <TransactionDetailScreen />
    </Suspense>
  );
}
