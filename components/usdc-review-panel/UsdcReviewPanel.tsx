'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle, XCircle, ArrowsClockwise, Coins } from '@phosphor-icons/react';
import styles from './UsdcReviewPanel.module.css';

interface ReviewClaim {
  id: string;
  questId: string;
  questTitle: string;
  recipientWallet: string;
  usdcAmount: number;
  username: string | null;
  createdAt: string;
}

interface UsdcReviewPanelProps {
  fetchWithAuth: (url: string, init?: RequestInit) => Promise<Response>;
}

function truncate(addr: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';
}

export default function UsdcReviewPanel({ fetchWithAuth }: UsdcReviewPanelProps) {
  const [claims, setClaims] = useState<ReviewClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/quests/usdc/review');
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims ?? []);
      } else {
        setClaims([]);
      }
    } catch {
      setClaims([]);
    } finally {
      setLoading(false);
    }
  }, [fetchWithAuth]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = useCallback(
    async (claim: ReviewClaim, action: 'approve' | 'reject') => {
      if (busyId) return;
      let note: string | null = null;
      if (action === 'reject') {
        note = window.prompt('Optional note for the member (why this was not approved):') || null;
      } else if (
        !window.confirm(
          `Approve and send $${claim.usdcAmount} USDC to ${truncate(claim.recipientWallet)}? This moves real funds from Blue's wallet.`,
        )
      ) {
        return;
      }

      setBusyId(claim.id);
      try {
        const res = await fetchWithAuth('/api/quests/usdc/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ claimId: claim.id, action, note }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setClaims((prev) => prev.filter((c) => c.id !== claim.id));
        } else {
          window.alert(data.error || 'Could not complete the review. Please try again.');
          if (res.status === 409) void load();
        }
      } catch {
        window.alert('Could not complete the review. Please try again.');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, fetchWithAuth, load],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.headIcon} aria-hidden="true">
            <Coins size={15} weight="fill" />
          </span>
          <span className={styles.title}>USDC payouts to review</span>
          {!loading && claims.length > 0 && <span className={styles.count}>{claims.length}</span>}
        </div>
        <button
          type="button"
          className={`${styles.refresh} ${loading ? styles.refreshSpin : ''}`}
          onClick={() => void load()}
          aria-label="Refresh"
          disabled={loading}
        >
          <ArrowsClockwise size={13} weight="bold" />
        </button>
      </div>

      {loading ? (
        <div className={styles.skeletonList}>
          <span className={styles.skeletonRow} />
          <span className={styles.skeletonRow} />
        </div>
      ) : claims.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyMark} aria-hidden="true">
            <CheckCircle size={20} weight="fill" />
          </span>
          <span className={styles.emptyTitle}>All caught up</span>
          <span className={styles.emptyText}>No USDC bounties are waiting for review.</span>
        </div>
      ) : (
        <ul className={styles.list}>
          {claims.map((claim) => (
            <li key={claim.id} className={styles.row}>
              <div className={styles.rowInfo}>
                <span className={styles.rowTitle}>{claim.questTitle}</span>
                <span className={styles.rowMeta}>
                  {claim.username ? `@${claim.username}` : 'Member'} · {truncate(claim.recipientWallet)}
                </span>
              </div>
              <span className={styles.rowAmount}>${claim.usdcAmount}</span>
              <div className={styles.rowActions}>
                <button
                  type="button"
                  className={styles.reject}
                  onClick={() => review(claim, 'reject')}
                  disabled={busyId === claim.id}
                  aria-label="Reject claim"
                  title="Reject"
                >
                  <XCircle size={16} weight="fill" />
                </button>
                <button
                  type="button"
                  className={styles.approve}
                  onClick={() => review(claim, 'approve')}
                  disabled={busyId === claim.id}
                >
                  <CheckCircle size={15} weight="fill" />
                  {busyId === claim.id ? 'Sending…' : 'Approve & pay'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
