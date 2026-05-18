'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { CourseData } from '@/lib/personal-course';
import { buildConnectome } from '@/lib/dsm-connectome';
import Connectome from './Connectome';
import styles from './Dashboard.module.css';

interface DashboardProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  initialIntake?: Record<string, string>;
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

export default function Dashboard(props: DashboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [eggShaking, setEggShaking] = useState(false);

  const connectome = useMemo(
    () => buildConnectome(props.initialIntake),
    [props.initialIntake],
  );

  useEffect(() => {
    fetch('/api/leaderboard')
      .then((r) => r.json())
      .then((d) => setLeaderboard(Array.isArray(d.users) ? d.users : []))
      .catch(() => {/* leaderboard is best-effort */});
  }, []);

  const pokeEgg = useCallback(() => {
    setEggShaking(true);
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const doonga = (start: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, start);
      osc.frequency.exponentialRampToValueAtTime(68, start + 0.2);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    };
    const now = ctx.currentTime;
    doonga(now + 0.02);
    doonga(now + 0.34);
    window.setTimeout(() => ctx.close(), 900);
  }, []);

  return (
    <div className={styles.dashboard}>
      {/* ── DSM symptom-cluster connectome ── */}
      <section className={styles.connectomeCard}>
        <div className={styles.connectomeHeader}>
          <span className={styles.cardLabel}>DSM connectome</span>
          <p className={styles.connectomeHint}>
            {connectome.source === 'intake'
              ? 'A live map of DSM symptom clusters — drag a node, hover for detail.'
              : 'A baseline map of DSM symptom clusters — drag a node, hover for detail.'}
          </p>
        </div>
        <Connectome connectome={connectome} />
      </section>

      {/* ── Side: egg, leaderboard, Blue ── */}
      <aside className={styles.sideStack}>
        <div className={styles.eggCard}>
          <button
            type="button"
            className={styles.eggMedia}
            onClick={pokeEgg}
            aria-label="Poke your egg"
          >
            <Image
              src="/images/egg.png"
              alt=""
              fill
              className={`${styles.eggImg}${eggShaking ? ` ${styles.eggShake}` : ''}`}
              onAnimationEnd={() => setEggShaking(false)}
              priority
            />
          </button>
          <h2 className={styles.eggTitle}>Your Egg</h2>
          <p className={styles.eggText}>
            Earn shards from quests and check-ins. What will hatch?
          </p>
        </div>

        <div className={styles.leaderboardCard}>
          <div className={styles.leaderHead}>
            <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
            <span className={styles.leaderTitle}>Leaderboard</span>
          </div>
          {leaderboard.length === 0 ? (
            <p className={styles.leaderEmpty}>No rankings yet — be the first to show up.</p>
          ) : (
            <ul className={styles.leaderList}>
              {leaderboard.slice(0, 5).map((u) => (
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
        </div>
      </aside>
    </div>
  );
}
