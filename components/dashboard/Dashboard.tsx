'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
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

interface EventItem {
  id: string;
  imageUrl: string;
  heading: string;
  category: string;
  date: string;
  time: string;
  description: string;
}

const EVENTS: EventItem[] = [
  {
    id: 'governance-workshop',
    imageUrl: '/images/academy-blockchain.png',
    heading: 'Blockchain Governance Workshop',
    category: 'Workshop',
    date: 'May 24, 2026',
    time: '5:00 PM UTC',
    description:
      'A hands-on session on how the Academy treasury votes, funds proposals, and keeps Blue accountable.',
  },
  {
    id: 'angel-investing-circle',
    imageUrl: '/images/angel-investing.png',
    heading: 'Angel Investing Circle',
    category: 'Discussion',
    date: 'May 28, 2026',
    time: '6:30 PM UTC',
    description:
      'Members walk through real deals together and learn to read a cap table without the jargon.',
  },
  {
    id: 'cohort-campfire',
    imageUrl: '/images/campfire.jpg',
    heading: 'Cohort Campfire Check-in',
    category: 'Community',
    date: 'May 31, 2026',
    time: '7:00 PM UTC',
    description:
      'An informal end-of-week gathering to share wins, blockers, and what the next week looks like.',
  },
  {
    id: 'funding-village-tour',
    imageUrl: '/images/funding-village-bg.jpg',
    heading: 'Funding Village Live Tour',
    category: 'Event',
    date: 'June 4, 2026',
    time: '4:00 PM UTC',
    description:
      'See newly funded projects, meet the builders, and learn how to put your own proposal forward.',
  },
];

export default function Dashboard(_props: DashboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderUser[]>([]);
  const [eggShaking, setEggShaking] = useState(false);
  const [reserved, setReserved] = useState<Record<string, boolean>>({});
  const [isProModalOpen, setIsProModalOpen] = useState(false);

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
      {/* ── Upcoming events ── */}
      <section className={styles.eventsSection}>
        <div className={styles.eventsHeader}>
          <span className={styles.cardLabel}>Upcoming events</span>
          <p className={styles.eventsHint}>
            Live sessions, circles, and gatherings — register or reserve a seat.
          </p>
        </div>
        <div className={styles.eventsGrid}>
          {EVENTS.map((ev) => (
            <article key={ev.id} className={styles.eventCard}>
              <div className={styles.eventImage}>
                <Image src={ev.imageUrl} alt="" fill style={{ objectFit: 'cover' }} />
              </div>
              <div className={styles.eventBody}>
                <span className={styles.eventMeta}>
                  {ev.category} • {ev.date}
                </span>
                <h3 className={styles.eventTitle}>{ev.heading}</h3>
                <p className={styles.eventText}>{ev.description}</p>
                <div className={styles.eventFoot}>
                  <span className={styles.eventTime}>{ev.time}</span>
                  <button
                    type="button"
                    className={styles.eventBtn}
                    onClick={() =>
                      setReserved((prev) => ({ ...prev, [ev.id]: true }))
                    }
                    disabled={!!reserved[ev.id]}
                  >
                    {reserved[ev.id] ? 'Reserved' : 'Register'}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ── Side: egg, leaderboard, Blue ── */}
      <aside className={styles.sideStack}>
        <div className={styles.eventsHeader}>
          <span className={styles.cardLabel}>Your progress</span>
          <p className={styles.eventsHint}>
            Hatch your egg and see where you stand.
          </p>
        </div>

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
        </div>

        <button
          type="button"
          className={styles.vipCard}
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
    </div>
  );
}
