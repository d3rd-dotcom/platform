'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { WalletErrorBoundary } from './WalletErrorBoundary';
import { AppShellSkeleton } from './AppShellSkeleton';

const Web3Provider = dynamic(
  () => import('./Web3Provider').then(mod => ({ default: mod.Web3Provider })),
  {
    ssr: false,
    // While the (heavy) Privy + wagmi chunk downloads, keep the skeleton up
    // instead of blanking the page.
    loading: () => <AppShellSkeleton />,
  }
);

export function ConditionalWeb3Provider({ children }: { children: React.ReactNode }) {
  // Render an immediate, server-rendered skeleton on first paint, then mount
  // the wallet provider after hydration. This gets real pixels on screen fast
  // (FCP/LCP) instead of waiting on the wallet SDK before anything renders.
  // The children already only mount client-side (Web3Provider is ssr:false),
  // so gating them one tick behind mount changes no behavior.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <AppShellSkeleton />;
  }

  return (
    <WalletErrorBoundary>
      <Web3Provider>{children}</Web3Provider>
    </WalletErrorBoundary>
  );
}
