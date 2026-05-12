'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import styles from './AcademyAccessGate.module.css';

type AccessState = 'checking' | 'needs-auth' | 'needs-profile' | 'ready' | 'error';

type MeUser = {
  id: string;
  username: string | null;
  avatarUrl: string | null;
  shardCount?: number;
  onboardingComplete?: boolean;
};

type MeResponse = {
  user: MeUser | null;
  error?: string;
  dbConfigured?: boolean;
  authDebug?: {
    walletExtracted?: boolean;
    userNotFound?: boolean;
  };
};

const PUBLIC_PATHS = new Set(['/library']);

function isPublicPath(pathname: string | null) {
  if (!pathname) return false;
  if (PUBLIC_PATHS.has(pathname)) return true;
  return Array.from(PUBLIC_PATHS).some((path) => pathname.startsWith(`${path}/`));
}

function needsProfile(user: MeUser | null) {
  if (!user) return true;
  return !user.username || user.username.startsWith('user_');
}

export default function AcademyAccessGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [error, setError] = useState<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const publicRoute = useMemo(() => isPublicPath(pathname), [pathname]);

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
    setError(null);
    setAccessState('checking');

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
      setAccessState('needs-profile');
      setIsOnboardingOpen(true);
      return;
    }

    setAccessState('ready');
    window.dispatchEvent(new Event('userLoaded'));
  }, [fetchMe, getAccessToken]);

  useEffect(() => {
    if (publicRoute || !ready) return;

    if (!authenticated) {
      setAccessState('needs-auth');
      setIsOnboardingOpen(false);
      return;
    }

    let cancelled = false;
    ensureAccount().catch((err) => {
      if (cancelled) return;
      console.error('[AcademyAccessGate] Account setup failed:', err);
      setError(err instanceof Error ? err.message : 'Account setup failed.');
      setAccessState('error');
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated, ensureAccount, publicRoute, ready]);

  const handleLogin = () => {
    setError(null);
    login();
  };

  const handleOnboardingComplete = () => {
    setIsOnboardingOpen(false);
    setAccessState('ready');
    window.dispatchEvent(new Event('profileUpdated'));
    window.dispatchEvent(new Event('userLoaded'));
  };

  // Public routes and authenticated users (including while Privy initializes): pass through immediately.
  // Onboarding modal surfaces on top if needs-profile is detected in the background.
  if (publicRoute || !ready || authenticated) {
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

  // Privy is ready and confirmed not authenticated: gate appears.
  return (
    <main className={styles.gateShell} aria-live="polite">
      <section className={styles.gatePanel}>
        <p className={styles.kicker}>Academy Access</p>
        <h1 className={styles.title}>Enter with an Academy account</h1>
        <p className={styles.copy}>
          The library stays open for browsing. Surveys, quests, shards, rewards, markets, profile state, and submissions require an account.
        </p>
        {accessState === 'error' && (
          <p className={styles.error}>{error || 'Something went wrong while preparing your account.'}</p>
        )}
        <button type="button" className={styles.primaryButton} onClick={handleLogin}>
          Login / Join Now
        </button>
      </section>
    </main>
  );
}
