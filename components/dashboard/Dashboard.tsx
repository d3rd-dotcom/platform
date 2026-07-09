'use client';

import React, { useState, useEffect } from 'react';
import BlueScene from '@/components/blue-scene/BlueScene';
import ChatRoom from '@/components/chat-room/ChatRoom';
import type { TreasurySnapshot } from '@/lib/treasury-snapshot';
import styles from './Dashboard.module.css';

interface LeaderUser {
  rank: number;
  username: string;
  avatarUrl: string | null;
  shards: number;
}

function avatarColor(name: string): string {
  const colors = ['#5168FF', '#E85D3A', '#62BE8F', '#9B7ED9', '#F5A623'];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function formatBalance(amount: string | null, maximumFractionDigits: number): string {
  if (amount === null) return 'Unavailable';
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Unavailable';
  if (value === 0) return '0';

  return value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: value < 0.01 ? Math.min(maximumFractionDigits, 4) : 0,
  });
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Dashboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [treasury, setTreasury] = useState<TreasurySnapshot | null>(null);
  const [treasuryFailed, setTreasuryFailed] = useState(false);

  useEffect(() => {
    if (!showLeaderboard) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLeaderboard(false);
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [showLeaderboard]);

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d.users) ? d.users : []))
      .catch(() => {/* leaderboard is best-effort */});
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/treasury/snapshot', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Treasury request failed');
        return response.json() as Promise<TreasurySnapshot>;
      })
      .then((snapshot) => setTreasury(snapshot))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setTreasuryFailed(true);
      });

    return () => controller.abort();
  }, []);

  return (
    <div className={styles.dashboard}>

      {/* ── BlueScene ── */}
      <div className={styles.blueSceneWrap}>
        <BlueScene />
      </div>

      {/* ── Sidebar: Leaderboard + Treasury + ChatRoom ── */}
      <aside className={styles.sidebarWrap}>
        <button
          type="button"
          className={styles.leaderboardCard}
          onClick={() => setShowLeaderboard(true)}
        >
          <div className={styles.leaderHead}>
            <span className={styles.leaderIcon}>金剛</span>
            <span className={styles.leaderTitle}>Leaderboard</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className={styles.leaderEmpty}>No rankings yet — be the first to show up.</p>
          ) : (
            <div className={styles.leaderAvatarRow}>
              {leaderboard.slice(0, 3).map((u) => (
                <div key={u.rank} className={styles.leaderAvatarItem}>
                  <span className={styles.leaderAvatarItemRank}>{u.rank}</span>
                  {u.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={u.avatarUrl} alt={u.username} className={styles.leaderAvatarItemImg} />
                  ) : (
                    <span
                      className={styles.leaderAvatarItemImg}
                      style={{ background: avatarColor(u.username || '?') }}
                    >
                      {(u.username || '?').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </button>

        <section className={`${styles.leaderboardCard} ${styles.treasuryCard}`} aria-labelledby="home-treasury-title">
          <div className={styles.leaderHead}>
            <span className={styles.leaderIcon}>財</span>
            <span id="home-treasury-title" className={`${styles.leaderTitle} ${styles.treasuryTitle}`}>
              Blue&apos;s treasury
            </span>
            {treasury?.status === 'live' && <span className={styles.treasuryLive}>Live</span>}
          </div>

          {treasuryFailed ? (
            <p className={styles.leaderEmpty}>Treasury balances are temporarily unavailable.</p>
          ) : (
            <>
              <div className={styles.treasuryGrid} aria-live="polite">
                <div className={styles.treasuryMetric}>
                  <span className={styles.treasuryMetricLabel}>cbBTC reserve</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.cbBtc.amount, 8) : '—'}
                    {treasury?.balances.cbBtc.amount !== null && <small> cbBTC</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <span className={styles.treasuryMetricLabel}>Credits held</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.credits.amount, 2) : '—'}
                    {treasury?.balances.credits.amount !== null && <small> credits</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <span className={styles.treasuryMetricLabel}>Reward reserve</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.usdc.amount, 2) : '—'}
                    {treasury?.balances.usdc.amount !== null && <small> USDC</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <span className={styles.treasuryMetricLabel}>Base gas</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.eth.amount, 6) : '—'}
                    {treasury?.balances.eth.amount !== null && <small> ETH</small>}
                  </strong>
                </div>
              </div>

              {treasury?.vault.address ? (
                <p className={styles.treasuryNote}>
                  {treasury.vault.totalDistributed === null
                    ? 'Reflection vault data is unavailable.'
                    : `${formatBalance(treasury.vault.totalDistributed, 4)} cbBTC distributed`}
                  {treasury.vault.eligibleHolders !== null
                    ? ` across ${treasury.vault.eligibleHolders.toLocaleString()} eligible holders.`
                    : '.'}
                </p>
              ) : treasury ? (
                <p className={styles.treasuryNote}>The reflection vault is awaiting its Base deployment.</p>
              ) : null}

              {treasury?.wallet.address && treasury.wallet.explorerUrl && (
                <a
                  className={styles.treasuryWalletLink}
                  href={treasury.wallet.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Wallet {shortAddress(treasury.wallet.address)}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </>
          )}
        </section>

        <div className={styles.chatRoomDesktopOnly}><ChatRoom fullPage /></div>
      </aside>

      {showLeaderboard && (
        <div className={styles.leaderModalOverlay} onClick={() => setShowLeaderboard(false)}>
          <div className={styles.leaderModalCard} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.leaderModalClose}
              onClick={() => setShowLeaderboard(false)}
              aria-label="Close leaderboard"
            >
              &times;
            </button>
            <div className={styles.leaderModalHeader}>
              <span className={styles.leaderModalIcon}>金剛</span>
              <span className={styles.leaderModalTitle}>Leaderboard</span>
            </div>
            <div className={styles.leaderModalList}>
              {leaderboard.length === 0 ? (
                <p className={styles.leaderEmpty}>No rankings yet</p>
              ) : (
                leaderboard.map((u) => (
                  <div key={u.rank} className={styles.leagueRow}>
                    <span className={styles.leagueRank}>{u.rank}</span>
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt={u.username} className={styles.leagueAvatar} />
                    ) : (
                      <div
                        className={styles.leagueAvatar}
                        style={{ background: avatarColor(u.username || '?') }}
                      >
                        {(u.username || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className={styles.leagueName}>{u.username}</span>
                    <span className={styles.leagueShards}>{u.shards.toLocaleString()} diamonds</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
