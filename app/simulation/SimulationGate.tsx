'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import ProMembershipModal from '@/components/pro-membership-modal/ProMembershipModal';
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
  const [access, setAccess] = useState<'loading' | 'allowed' | 'denied'>('loading');
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setAccess('denied');
      return;
    }
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
        if (!cancelled) setAccess(data?.hasVipMembershipCard ? 'allowed' : 'denied');
      } catch {
        if (!cancelled) setAccess('denied');
      }
    })();
    return () => {
      cancelled = true;
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
    if (!authenticated) {
      login();
    } else {
      setModalOpen(true);
    }
  }, [authenticated, login]);

  // All hooks above run unconditionally; this early return is safe.
  if (DEV_BYPASS) return <SimulationWorkspace />;

  if (access === 'loading' || !ready) {
    return (
      <div className={styles.gateState}>
        <span className={styles.spinnerInline} aria-hidden />
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
          <button className={styles.primaryBtn} onClick={unlock}>
            {authenticated ? 'Unlock with Pro' : 'Sign in to continue'}
          </button>
        </div>
        <ProMembershipModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  return <SimulationWorkspace />;
}
