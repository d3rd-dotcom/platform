'use client';

import type { ReactNode } from 'react';
import { SidebarStateProvider } from '@/components/side-navigation/SidebarStateProvider';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { ConditionalWeb3Provider } from '@/components/web3/ConditionalWeb3Provider';
import TopNavigation from '@/components/top-navigation/TopNavigation';
import MobileBottomNav from '@/components/mobile-bottom-nav/MobileBottomNav';
import AcademyAccessGate from '@/components/auth/AcademyAccessGate';
import MiniAppAutoAuth from '@/components/miniapp/MiniAppAutoAuth';

interface AuthenticatedAppShellProps {
  children: ReactNode;
  initialCollapsed: boolean;
}

export function AuthenticatedAppShell({
  children,
  initialCollapsed,
}: AuthenticatedAppShellProps) {
  return (
    <SidebarStateProvider initialCollapsed={initialCollapsed}>
      <ConditionalWeb3Provider>
        <ThemeProvider>
          <MiniAppAutoAuth />
          <TopNavigation />
          <AcademyAccessGate>{children}</AcademyAccessGate>
          <MobileBottomNav />
        </ThemeProvider>
      </ConditionalWeb3Provider>
    </SidebarStateProvider>
  );
}
