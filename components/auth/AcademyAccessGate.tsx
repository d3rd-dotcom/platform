'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
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
  const [validatedPath, setValidatedPath] = useState<string | null>(null);
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

    setValidatedPath(pathname);
    setAccessState('ready');
    window.dispatchEvent(new Event('userLoaded'));
  }, [fetchMe, getAccessToken, pathname]);

  useEffect(() => {
    if (publicRoute) {
      setAccessState('ready');
      setValidatedPath(null);
      setIsOnboardingOpen(false);
      return;
    }

    if (!ready) {
      setAccessState('checking');
      return;
    }

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
    setValidatedPath(pathname);
    setAccessState('ready');
    window.dispatchEvent(new Event('profileUpdated'));
    window.dispatchEvent(new Event('userLoaded'));
  };

  if (publicRoute || (accessState === 'ready' && validatedPath === pathname)) {
    return <>{children}</>;
  }

  const displayState: AccessState = accessState === 'ready' ? 'checking' : accessState;

  return (
    <main className={styles.gateShell} aria-live="polite">
      <section className={styles.gatePanel}>
        <p className={styles.kicker}>Academy Access</p>
        <h1 className={styles.title}>
          {displayState === 'needs-profile' ? 'Finish setting up your profile' : 'Enter with an Academy account'}
        </h1>
        <p className={styles.copy}>
          {displayState === 'needs-profile'
            ? 'Choose a username before surveys, quests, rewards, profile tools, and submissions start saving to your account.'
            : 'The library stays open for browsing. Surveys, quests, shards, rewards, markets, profile state, and submissions require an account.'}
        </p>

        {displayState === 'checking' && (
          <div className={styles.status}>
            <DotmSquare3 speed={1.2} dotSize={7} gap={4} />
          </div>
        )}
        {displayState === 'error' && (
          <p className={styles.error}>{error || 'Something went wrong while preparing your account.'}</p>
        )}

        {displayState === 'needs-auth' && (
          <button type="button" className={styles.primaryButton} onClick={handleLogin}>
            Login / Join Now
          </button>
        )}

        {(displayState === 'needs-profile' || displayState === 'error') && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => {
              if (displayState === 'needs-profile') {
                setIsOnboardingOpen(true);
              } else {
                ensureAccount().catch((err) => {
                  console.error('[AcademyAccessGate] Retry failed:', err);
                  setError(err instanceof Error ? err.message : 'Account setup failed.');
                  setAccessState('error');
                });
              }
            }}
          >
            {displayState === 'needs-profile' ? 'Complete Setup' : 'Try Again'}
          </button>
        )}
      </section>

      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />
    </main>
  );
}
