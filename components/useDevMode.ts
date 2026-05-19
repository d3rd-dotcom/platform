'use client';

import { useEffect, useState } from 'react';

/**
 * Dev-only feature gate. Returns true in development, or anywhere the URL has
 * carried `?vipdev=1` at least once (the flag is then remembered in
 * localStorage). Ordinary users never see dev affordances.
 */
export function useDevMode(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      setEnabled(true);
      return;
    }
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('vipdev') === '1') {
        window.localStorage.setItem('mwa_vipdev', '1');
        setEnabled(true);
        return;
      }
      setEnabled(window.localStorage.getItem('mwa_vipdev') === '1');
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  return enabled;
}
