import { Suspense } from 'react';

import { Spinner } from '@/components/Shell';
import { BudgetDetailScreen } from '@/screens/BudgetDetailScreen';

// Client-rendered from IndexedDB behind the loading gate; see layout.tsx.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <BudgetDetailScreen />
    </Suspense>
  );
}
