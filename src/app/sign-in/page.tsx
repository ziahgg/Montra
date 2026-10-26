import { Suspense } from 'react';

import { Spinner } from '@/components/Shell';
import { SignInScreen } from '@/screens/WelcomeScreen';

// Client-rendered from IndexedDB behind the loading gate; see layout.tsx.
export const instant = false;

export default function Page() {
  return (
    <Suspense fallback={<Spinner />}>
      <SignInScreen />
    </Suspense>
  );
}
