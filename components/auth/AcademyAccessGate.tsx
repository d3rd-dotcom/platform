'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePrivy } from '@privy-io/react-auth';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { useDevOnboarding, getDevWallet, clearDevOnboardingState } from '@/components/useDevMode';

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
 * for users who choose to sign in (so credits, points, and rewards can be tracked).
 */
export default function AcademyAccessGate({ children }: { children: ReactNode }) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const devOnboarding = useDevOnboarding();
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const fetchMe = useCallback(async (): Promise<MeResponse> => {
    const token = await getAccessToken();
    const headers: HeadersInit = devOnboarding
      ? { 'x-dev-bypass': getDevWallet() }
      : token ? { Authorization: `Bearer ${token}` } : {};
    const response = await fetch('/api/me', {
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
    return response.json().catch(() => ({ user: null }));
  }, [getAccessToken, devOnboarding]);

  const ensureAccount = useCallback(async () => {
    const token = await getAccessToken();
    const devWallet = getDevWallet();
    const headers: HeadersInit = devOnboarding
      ? { 'x-dev-bypass': devWallet, 'Content-Type': 'application/json' }
      : token ? { Authorization: `Bearer ${token}` } : {};

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
  }, [fetchMe, getAccessToken, devOnboarding]);

  useEffect(() => {
    if (devOnboarding) {
      let cancelled = false;
      ensureAccount().catch((err) => {
        if (cancelled) return;
        console.error('[AcademyAccessGate] Dev onboarding setup failed:', err);
      });
      return () => { cancelled = true; };
    }
  }, [devOnboarding, ensureAccount]);

  useEffect(() => {
    if (!ready || !authenticated || devOnboarding) return;

    let cancelled = false;
    ensureAccount().catch((err) => {
      if (cancelled) return;
      console.error('[AcademyAccessGate] Account setup failed:', err);
    });

    return () => {
      cancelled = true;
    };
  }, [authenticated, ensureAccount, ready, devOnboarding]);

  useEffect(() => {
    const handleOpenOnboarding = () => setIsOnboardingOpen(true);
    window.addEventListener('openOnboarding', handleOpenOnboarding);
    return () => window.removeEventListener('openOnboarding', handleOpenOnboarding);
  }, []);

  const handleOnboardingComplete = () => {
    setIsOnboardingOpen(false);
    window.dispatchEvent(new Event('profileUpdated'));
    window.dispatchEvent(new Event('userLoaded'));
  };

  const [panelMounted, setPanelMounted] = useState(false);
  useEffect(() => { setPanelMounted(true); }, []);

  const showPanel = process.env.NODE_ENV !== 'production' && panelMounted;

  const startOnboarding = () => {
    clearDevOnboardingState();
    const wallet = getDevWallet();
    try { window.localStorage.setItem('mwa_devonboard', '1'); } catch {}
    try { window.sessionStorage.setItem('mwa_dev_wallet', wallet); } catch {}
    window.location.href = '/home?devonboard=1';
  };

  const resetOnboarding = () => {
    clearDevOnboardingState();
    const keys = [
      'mwa-home-intro-pending',
      'hasSeenOnboardingTour',
      'mwa-home-intro-seen',
      'mwa-first-daily-note-done',
      'mwa-course-tour-pending',
    ];
    keys.forEach((k) => { try { window.localStorage.removeItem(k); } catch {} });
    window.location.reload();
  };

  return (
    <>
      {children}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onComplete={handleOnboardingComplete}
      />
      {showPanel && createPortal(
        <div style={{
          position: 'fixed', right: 12, bottom: 12, zIndex: 9500,
          display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
          maxWidth: 220, padding: '8px 10px',
          background: 'rgba(8,10,16,0.92)', border: '1px dashed rgba(255,255,255,0.28)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          pointerEvents: 'auto',
        }}>
          <span style={{ width: '100%', fontSize: 10, letterSpacing: '0.04em', color: 'rgba(255,255,255,0.55)' }}>
            Dev Onboarding {devOnboarding ? '(active)' : '(off)'}
          </span>
          <button type="button" onClick={startOnboarding} style={btnStyle}>
            Start Onboarding
          </button>
          <button type="button" onClick={resetOnboarding} style={{...btnStyle, borderColor: 'rgba(255,100,100,0.4)', color: '#ff8a8a'}}>
            Reset
          </button>
        </div>,
        document.body
      )}
    </>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '4px 9px', fontSize: 11, fontWeight: 600,
  color: '#e8eaf2', background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: 7, cursor: 'pointer',
};
