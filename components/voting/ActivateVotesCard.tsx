'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { readVotingStatus, activateVotes, type VotingStatus } from '@/lib/governance-token';
import { useSound } from '@/hooks/useSound';
import styles from './ActivateVotesCard.module.css';

/**
 * One-time prompt that turns a holder's MWG into usable votes. We never say
 * "delegate" — to a user it's just "activate." Shows only when the connected
 * wallet holds tokens that aren't active yet.
 */
const ActivateVotesCard: React.FC = () => {
  const { address, isConnected, connector } = useAccount();
  const { play } = useSound();
  const [status, setStatus] = useState<VotingStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [justActivated, setJustActivated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!address) { setStatus(null); return; }
    try {
      setStatus(await readVotingStatus(address));
    } catch {
      setStatus(null);
    }
  }, [address]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleActivate = async () => {
    if (!connector) return;
    setWorking(true);
    setError(null);
    try {
      const provider = await connector.getProvider();
      await activateVotes(provider);
      setJustActivated(true);
      await refresh();
    } catch (e: any) {
      if (e?.code === 'ACTION_REJECTED' || e?.code === 4001) setError('Cancelled.');
      else setError('Could not activate. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  // Nothing to show: not connected, no tokens, or already active (and not the
  // moment right after activating).
  if (!isConnected || !status || !status.hasTokens) return null;
  if (status.isActive && !justActivated) return null;

  if (status.isActive || justActivated) {
    return (
      <div className={`${styles.card} ${styles.done}`}>
        <div className={styles.icon} aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <div className={styles.body}>
          <p className={styles.title}>Your votes are active</p>
          <p className={styles.sub}>{status.balanceWhole.toLocaleString()} MWG ready to vote on new proposals.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.body}>
        <p className={styles.title}>Turn your tokens into votes</p>
        <p className={styles.sub}>
          You have {status.balanceWhole.toLocaleString()} MWG. Activate once so they count when you vote.
          Takes a few seconds and only happens one time.
        </p>
        {error && <p className={styles.error}>{error}</p>}
      </div>
      <button
        className={styles.button}
        onClick={() => { play('click'); void handleActivate(); }}
        onMouseEnter={() => play('hover')}
        disabled={working}
        type="button"
      >
        {working ? 'Activating...' : 'Activate votes'}
      </button>
    </div>
  );
};

export default ActivateVotesCard;
