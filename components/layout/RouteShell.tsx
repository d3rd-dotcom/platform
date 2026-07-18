'use client';

import { useEffect, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const AuthenticatedAppShell = dynamic(() =>
  import('./AuthenticatedAppShell').then((mod) => mod.AuthenticatedAppShell)
);

interface RouteShellProps {
  children: ReactNode;
  initialCollapsed?: boolean;
}

export function RouteShell({ children, initialCollapsed = true }: RouteShellProps) {
  const pathname = usePathname();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (
    pathname === '/' ||
    pathname === '/faq' ||
    pathname === '/products-and-services'
  ) {
    return <>{children}</>;
  }

  return (
    <AuthenticatedAppShell initialCollapsed={initialCollapsed}>
      {children}
    </AuthenticatedAppShell>
  );
}
