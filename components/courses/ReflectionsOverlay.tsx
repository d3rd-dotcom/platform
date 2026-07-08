'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Diamond, ArrowUpRight, ArrowDownRight } from '@phosphor-icons/react';
import { useScrollLock } from '@/hooks/useScrollLock';
import styles from './ReflectionsOverlay.module.css';

interface TreasuryData {
  walletAddress: string | null;
  shardCount: number;
  onchainBalance: number | null;
  totalEarned: number;
  totalSpent: number;
  rewards: Array<{ source: string; amount: number; delivery: string; status: string; created_at: string }>;
  burns: Array<{ purpose: string; amount: number; tx_hash: string; created_at: string }>;
  chain: { name: string; explorerUrl: string };
}

interface Props {
  onClose: () => void;
}

function shortHash(hash: string): string {
  if (hash.length < 16) return hash;
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function ReflectionsOverlay({ onClose }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<TreasuryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useScrollLock(mounted);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/me/treasury');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not load treasury data.');
        return;
      }
      setData(await res.json());
    } catch {
      setError('Network error loading treasury data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) load();
  }, [mounted, load]);

  const transactions = useMemo(() => {
    const txs: Array<{ date: string; label: string; amount: number; type: 'earned' | 'spent'; txHash?: string }> = [];
    if (!data) return txs;
    for (const r of data.rewards) {
      txs.push({
        date: r.created_at,
        label: `Reward — ${r.source.replace(/_/g, ' ')}`,
        amount: r.amount,
        type: 'earned',
      });
    }
    for (const b of data.burns) {
      txs.push({
        date: b.created_at,
        label: b.purpose.charAt(0).toUpperCase() + b.purpose.slice(1),
        amount: b.amount,
        type: 'spent',
        txHash: b.tx_hash,
      });
    }
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return txs.slice(0, 20);
  }, [data]);

  if (!mounted || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Reflections">
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Diamond size={18} weight="fill" className={styles.titleIcon} />
            Reflections
          </h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className={styles.body}>
          {loading && <div className={styles.state}>Loading…</div>}
          {error && <div className={styles.stateError}>{error}</div>}

          {data && (
            <>
              <div className={styles.statsGrid}>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>$BLUE Balance</span>
                  <span className={styles.statValue}>
                    {data.onchainBalance ?? data.shardCount}
                  </span>
                  <span className={styles.statSub}>
                    {data.onchainBalance !== null ? 'onchain' : 'in-app credits'}
                  </span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Total Earned</span>
                  <span className={styles.statValueGreen}>
                    <ArrowUpRight size={14} weight="bold" />
                    {data.totalEarned}
                  </span>
                  <span className={styles.statSub}>all-time $BLUE</span>
                </div>
                <div className={styles.statCard}>
                  <span className={styles.statLabel}>Total Spent</span>
                  <span className={styles.statValueRed}>
                    <ArrowDownRight size={14} weight="bold" />
                    {data.totalSpent}
                  </span>
                  <span className={styles.statSub}>burns and purchases</span>
                </div>
              </div>

              {data.walletAddress && (
                <div className={styles.walletRow}>
                  <span className={styles.walletLabel}>Wallet</span>
                  <span className={styles.walletAddress}>{shortHash(data.walletAddress)}</span>
                  <span className={styles.chainBadge}>{data.chain.name}</span>
                </div>
              )}

              {transactions.length > 0 && (
                <div className={styles.txSection}>
                  <h3 className={styles.txHeading}>Recent Activity</h3>
                  <div className={styles.txList}>
                    {transactions.map((tx, i) => (
                      <div key={`${tx.date}-${i}`} className={styles.txRow}>
                        <div className={styles.txLeft}>
                          <span className={`${styles.txDot} ${tx.type === 'earned' ? styles.txDotEarned : styles.txDotSpent}`} />
                          <div className={styles.txInfo}>
                            <span className={styles.txLabel}>{tx.label}</span>
                            <span className={styles.txDate}>{formatDate(tx.date)}</span>
                          </div>
                        </div>
                        <span className={`${styles.txAmount} ${tx.type === 'earned' ? styles.txEarned : styles.txSpent}`}>
                          {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {transactions.length === 0 && (
                <div className={styles.empty}>
                  No activity yet. Earn $BLUE by completing guides and courses.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
