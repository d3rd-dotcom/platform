'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import BlueScene from '@/components/blue-scene/BlueScene';
import ChatRoom from '@/components/chat-room/ChatRoom';
import type { FrontierGuide } from '@/lib/guides-db';
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

export default function Dashboard() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [nextUpGuides, setNextUpGuides] = useState<FrontierGuide[]>([]);

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

  // Knowledge Base "next up": a small taste of the guides frontier, linking
  // out to the full picture on /courses.
  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/frontier', { cache: 'no-store', headers });
        if (res.ok) {
          const d = await res.json();
          setNextUpGuides(Array.isArray(d.guides) ? d.guides.slice(0, 3) : []);
        }
      } catch {/* next-up is best-effort */}
    })();
  }, [ready, authenticated, getAccessToken]);

  return (
    <div className={styles.dashboard}>

      {/* ── BlueScene ── */}
      <div className={styles.blueSceneWrap}>
        <BlueScene />
      </div>

      {/* ── Sidebar: Leaderboard + Knowledge Tree + ChatRoom ── */}
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

        {nextUpGuides.length > 0 && (
          <div className={styles.leaderboardCard}>
            <div className={styles.leaderHead}>
              <span className={styles.leaderIcon}>木</span>
              <span className={styles.leaderTitle}>Knowledge Tree</span>
            </div>
            <ul className={styles.nextUpList}>
              {nextUpGuides.map((g) => (
                <li key={g.id}>
                  <Link href={`/courses/guides/${g.slug}`} className={styles.nextUpRow}>
                    <span className={styles.nextUpTitle}>{g.topicTitle}</span>
                    <span className={styles.nextUpChevron} aria-hidden="true">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

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
