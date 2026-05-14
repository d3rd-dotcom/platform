'use client';

import { ReactNode, useEffect } from 'react';

interface MiniAppProviderProps {
  children: ReactNode;
}

export function MiniAppProvider({ children }: MiniAppProviderProps) {
  useEffect(() => {
    import('@farcaster/miniapp-sdk')
      .then(({ sdk }) => sdk.actions.ready())
      .catch(() => {});
  }, []);

  return <>{children}</>;
}
