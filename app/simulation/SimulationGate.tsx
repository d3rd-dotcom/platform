'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import ProMembershipModal from '@/components/pro-membership-modal/ProMembershipModal';
import { useSound } from '@/hooks/useSound';
import { setSimulationAccessTokenProvider } from '@/lib/simulation-api';
import Button from '@/components/button/Button';
import SimulationWorkspace from './SimulationWorkspace';
import styles from './simulation.module.css';

/**
 * Pro-only gate for /simulation. Mirrors the membership check used by Markets /
 * Quests: GET /api/account/status -> hasVipMembershipCard, authed with a Privy
 * token. Non-members see a locked screen with the Pro upgrade modal.
 */
// Local-dev escape hatch: when Privy can't run locally (its domain allowlist
// blocks localhost), set NEXT_PUBLIC_SIMULATION_DEV_BYPASS=true to skip the gate.
// Hard-guarded to non-production so it can never open the gate in a real build.
const DEV_BYPASS =
  process.env.NODE_ENV !== 'production' &&
  process.env.NEXT_PUBLIC_SIMULATION_DEV_BYPASS === 'true';

export default function SimulationGate() {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();

  // Bootstrap from localStorage so VIP users skip the loading spinner.
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied'>(() => {
    if (typeof window === 'undefined') return 'loading';
    try {
      const cached = localStorage.getItem('simulation_access');
      if (cached) {
        const { allowed, ts } = JSON.parse(cached);
        if (allowed && Date.now() - ts < 120_000) return 'allowed';
      }
    } catch { /* ignore */ }
    return 'loading';
  });
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setSimulationAccessTokenProvider(null);
      setAccess('denied');
      return;
    }
    // All workspace calls pass through the authenticated server-side proxy.
    // Keep token retrieval live so longer simulations survive token refreshes.
    setSimulationAccessTokenProvider(getAccessToken);
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/account/status', {
          credentials: 'include',
          cache: 'no-store',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = res.ok ? await res.json().catch(() => null) : null;
        const allowed = data?.hasVipMembershipCard === true;
        if (!cancelled) {
          setAccess(allowed ? 'allowed' : 'denied');
          if (allowed) {
            try { localStorage.setItem('simulation_access', JSON.stringify({ allowed: true, ts: Date.now() })); } catch { /* ignore */ }
          } else {
            try { localStorage.removeItem('simulation_access'); } catch { /* ignore */ }
          }
        }
      } catch {
        if (!cancelled) setAccess('denied');
      }
    })();
    return () => {
      cancelled = true;
      setSimulationAccessTokenProvider(null);
    };
  }, [ready, authenticated, getAccessToken]);

  // Re-check when membership/login changes elsewhere in the app.
  useEffect(() => {
    const recheck = () => setAccess('loading');
    window.addEventListener('vipMembershipUpdated', recheck);
    window.addEventListener('userLoggedIn', recheck);
    return () => {
      window.removeEventListener('vipMembershipUpdated', recheck);
      window.removeEventListener('userLoggedIn', recheck);
    };
  }, []);

  const unlock = useCallback(() => {
    play('click');
    if (!authenticated) {
      login();
    } else {
      setModalOpen(true);
    }
  }, [authenticated, login, play]);

  // All hooks above run unconditionally; this early return is safe.
  if (DEV_BYPASS) return <SimulationWorkspace />;

  if (access === 'loading' || !ready) {
    return (
      <div className={styles.gateState}>
        <div className={styles.loaderBlock} aria-live="polite">
          <DotmSquare3 speed={0.9} dotSize={5} gap={3} />
          <p className={styles.muted}>Checking access…</p>
        </div>
      </div>
    );
  }

  if (access === 'denied') {
    return (
      <>
        <div className={styles.lockedCard}>
          <h1 className={styles.lockedTitle}>Simulations is a Pro feature</h1>
          <p className={styles.lockedText}>
            Build living worlds of autonomous agents from any document, run them forward, and read
            the futures they produce. Available to Pro members.
          </p>
          <Button onClick={unlock} onMouseEnter={() => play('hover')}>
            {authenticated ? 'Unlock with Pro' : 'Sign in to continue'}
          </Button>
        </div>
        <ProMembershipModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return <SimulationWorkspace />;
}
