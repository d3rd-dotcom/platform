'use client';

import { useEffect, useState } from 'react';

const DEVONBOARD_KEY = 'mwa_devonboard';

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

function readDevOnboardingFlag(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    if (params.get('devonboard') === '1') {
      window.localStorage.setItem(DEVONBOARD_KEY, '1');
      return true;
    }
    return window.localStorage.getItem(DEVONBOARD_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Dev-only onboarding mode. Returns true when:
 *  - NODE_ENV !== 'production' AND
 *  - URL has `?devonboard=1` (saved to localStorage) OR
 *  - localStorage has `mwa_devonboard = '1'`
 *
 * Reads synchronously so even components mounted inside persistent layouts
 * (e.g. AcademyAccessGate in AuthenticatedAppShell) get the correct value
 * after a full page reload — which is what DevOnboardingPanel.startOnboarding
 * performs.
 *
 * When active, AcademyAccessGate and OnboardingModal bypass Privy/wallet
 * auth and use a dev wallet via the `x-dev-bypass` header instead.
 */
export function useDevOnboarding(): boolean {
  const [enabled, setEnabled] = useState(() => {
    if (process.env.NODE_ENV === 'production') return false;
    return readDevOnboardingFlag();
  });

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    setEnabled(readDevOnboardingFlag());
  }, []);

  return enabled;
}

/**
 * Generates a unique dev wallet address for this session.
 * Stored in sessionStorage so it persists across page reloads but not tabs.
 */
export function getDevWallet(): string {
  if (typeof window === 'undefined') return '0xdev000000000000000000000000000000000001';
  try {
    let wallet = window.sessionStorage.getItem('mwa_dev_wallet');
    if (!wallet) {
      const suffix = Math.random().toString(16).slice(2, 10);
      wallet = `0xdev${suffix.padStart(38, '0')}`;
      window.sessionStorage.setItem('mwa_dev_wallet', wallet);
    }
    return wallet;
  } catch {
    return '0xdev000000000000000000000000000000000001';
  }
}

/**
 * Clears all dev onboarding state (localStorage + sessionStorage).
 */
export function clearDevOnboardingState(): void {
  try {
    window.localStorage.removeItem(DEVONBOARD_KEY);
    window.sessionStorage.removeItem('mwa_dev_wallet');
    window.localStorage.removeItem('mwa-home-intro-pending');
    window.localStorage.removeItem('hasSeenOnboardingTour');
  } catch {
    /* best-effort */
  }
}
