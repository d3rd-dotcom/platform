'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import OnboardingModal from '@/components/onboarding/OnboardingModal';

type MeUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
};

type MeResponse = {
  user: MeUser | null;
};

function needsProfile(user: MeUser | null) {
  if (!user) return true;
  return !user.username || user.username.startsWith('user_');
}

/**
 * The platform is free to browse without an account. This component no longer
 * blocks any route — it only creates an account and surfaces profile onboarding
 * for users who choose to sign in (so shards, points, and rewards can be tracked).
 */
export default function AcademyAccessGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const fetchMe = useCallback(async (): Promise<MeResponse> => {
    const token = await getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch('/api/me', {
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
    return response.json().catch(() => ({ user: null }));
  }, [getAccessToken]);

  const ensureAccount = useCallback(async () => {
    const token = await getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

    let meData = await fetchMe();
    if (!meData.user) {
      const signupResponse = await fetch('/api/auth/wallet-signup', {
        method: 'POST',
        credentials: 'include',
        headers,
      });

      if (!signupResponse.ok) {
        const signupData = await signupResponse.json().catch(() => ({}));
        throw new Error(signupData.error || 'Account setup failed.');
      }

      window.dispatchEvent(new Event('userLoggedIn'));
      meData = await fetchMe();
    }

    if (needsProfile(meData.user)) {
      setIsOnboardingOpen(true);
      return;
    }

    window.dispatchEvent(new Event('userLoaded'));
  }, [fetchMe, getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    let cancelled = false;
    ensureAccount().catch((err) => {
      if (cancelled) return;
      console.error('[AcademyAccessGate] Account setup failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated, ensureAccount, ready]);

  const handleOnboardingComplete = () => {
    setIsOnboardingOpen(false);
    window.dispatchEvent(new Event('profileUpdated'));
    window.dispatchEvent(new Event('userLoaded'));
  };

  return (
    <>
      {children}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />
    </>
  );
}
