'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, useTransition } from 'react';
import Loading from './loading';

export function DashboardWrapper({ children }: { children: React.ReactNode }) {
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Track when search params change
  useEffect(() => {
    setIsNavigating(false);
  }, [searchParams]);

  // Show loading state when navigating or transition pending
  if (isPending || isNavigating) {
    return <Loading />;
  }

  return <>{children}</>;
}

export function DashboardSuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Loading />}>
      <DashboardWrapper>{children}</DashboardWrapper>
    </Suspense>
  );
}