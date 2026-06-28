'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import BlueScene from '@/components/blue-scene/BlueScene';
import CaseMonitor from '@/components/case-monitor/CaseMonitor';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import PhotoSafari from '@/components/photo-safari/PhotoSafari';
import styles from './Dashboard.module.css';

interface DashboardProps {
  enableMorningPagesPersistence?: boolean;
}

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

export default function Dashboard({ enableMorningPagesPersistence = false }: DashboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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

  return (
    <div className={styles.dashboard}>
      {/* ── Main content area ── */}
      <main className={styles.mainArea}>
        <BlueScene />
        <div className={styles.photoSafariMobile}>
          <PhotoSafari />
        </div>
        <CaseMonitor />
      </main>

      {/* ── Side: leaderboard, morning note, membership ── */}
      <aside className={styles.sideStack}>
        <div className={styles.sideStackInner}>

          <button
            type="button"
            className={styles.leaderboardCard}
            onClick={() => setShowLeaderboard(true)}
          >
            <div className={styles.leaderHead}>
              <Image src="/icons/ui-diamond.svg" alt="" width={14} height={14} />
              <span className={styles.leaderTitle}>Leaderboard</span>
            </div>
            {leaderboard.length === 0 ? (
              <p className={styles.leaderEmpty}>No rankings yet — be the first to show up.</p>
            ) : (
              <ul className={styles.leaderList}>
                {leaderboard.slice(0, 3).map((u) => (
                  <li key={u.rank} className={styles.leaderRow}>
                    <span className={styles.leaderRank}>{u.rank}</span>
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt={u.username} className={styles.leaderAvatar} />
                    ) : (
                      <span
                        className={styles.leaderAvatar}
                        style={{ background: avatarColor(u.username || '?') }}
                      >
                        {(u.username || '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className={styles.leaderName}>{u.username}</span>
                    <span className={styles.leaderShards}>{u.shards}</span>
                  </li>
                ))}
              </ul>
            )}
          </button>

          <div className={styles.photoSafariDesktop}>
            <PhotoSafari />
          </div>
        </div>

        <div className={styles.morningPagesShell} data-tour="daily-note">
          <div className={styles.morningPagesGradient} aria-hidden="true" />
          <DailyNotes
            enablePersistence={enableMorningPagesPersistence}
            compact
          />
        </div>

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
              <Image src="/icons/ui-diamond.svg" alt="" width={28} height={28} />
              <div>
                <strong className={styles.leaderModalTitle}>Leaderboard</strong>
                <span className={styles.leaderModalSub}>Top contributors</span>
              </div>
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
                    <span className={styles.leagueShards}>{u.shards} diamonds</span>
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
