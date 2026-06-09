'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import InventoryPanel from '@/components/inventory-panel/InventoryPanel';
import type { CourseData } from '@/lib/personal-course';
import styles from './Dashboard.module.css';

const ProMembershipModal = dynamic(
  () => import('../pro-membership-modal/ProMembershipModal'),
  { ssr: false },
);

interface DashboardProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  initialIntake?: Record<string, string>;
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
  const [isProModalOpen, setIsProModalOpen] = useState(false);
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
      <main className={styles.mainArea} />

      {/* ── Side: morning note, leaderboard, membership ── */}
      <aside className={styles.sideStack}>
        <div className={styles.eventsHeader}>
          <span className={styles.cardLabel}>Your progress</span>
          <p className={styles.eventsHint}>
            Keep your streak and see where you stand.
          </p>
        </div>

        <div className={styles.morningPagesShell} data-tour="daily-note">
          <div className={styles.morningPagesGradient} aria-hidden="true" />
          <DailyNotes
            enablePersistence={enableMorningPagesPersistence}
            compact
          />
        </div>

        <InventoryPanel />

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

        <button
          type="button"
          className={styles.vipCard}
          data-tour="vip"
          onClick={() => setIsProModalOpen(true)}
        >
          <div className={styles.vipHead}>
            <svg
              className={styles.vipIcon}
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5 16L3 6l5.5 4L12 4l3.5 6L21 6l-2 10H5zm0 3h14v2H5z" />
            </svg>
            <span className={styles.vipTitle}>VIP Membership</span>
          </div>
          <p className={styles.vipText}>
            One payment, lifetime access — unlock R-Tool, Simulations, and every tool we build.
          </p>
          <span className={styles.vipCta}>
            Go VIP
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M6 3L11 8L6 13"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </button>
      </aside>

      {isProModalOpen && (
        <ProMembershipModal isOpen={isProModalOpen} onClose={() => setIsProModalOpen(false)} />
      )}

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
