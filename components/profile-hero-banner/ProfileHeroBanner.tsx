'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import styles from './ProfileHeroBanner.module.css';

interface BannerData {
  username: string | null;
  avatarUrl: string | null;
  streak: number;
  monthlyCount: number;
  totalEntries: number;
  completedDates: Set<string>;
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isThisMonth(dateKey: string, now: Date) {
  const [year, month] = dateKey.split('-').map(Number);
  return year === now.getFullYear() && month === now.getMonth() + 1;
}

function formatShortDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

export default function ProfileHeroBanner() {
  const { ready, authenticated, user, login, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;
  const [data, setData] = useState<BannerData>({
    username: null,
    avatarUrl: null,
    streak: 0,
    monthlyCount: 0,
    totalEntries: 0,
    completedDates: new Set(),
  });
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const [streakRes, notesRes, profileRes] = await Promise.all([
        fetch('/api/daily-notes/streak', { credentials: 'include', cache: 'no-store', headers }),
        fetch('/api/daily-notes', { credentials: 'include', cache: 'no-store', headers }),
        fetch('/api/profile', { credentials: 'include', cache: 'no-store', headers }),
      ]);

      let streak = 0;
      const completedDates = new Set<string>();
      let username: string | null = null;
      let avatarUrl: string | null = null;

      if (streakRes.ok) {
        const d = await streakRes.json();
        streak = d.streak ?? 0;
      }

      if (notesRes.ok) {
        const d = await notesRes.json();
        Object.values(d.allWeekPages ?? {}).forEach((entries) => {
          (entries as Array<{ date?: string }>).forEach((entry) => {
            if (entry?.date) completedDates.add(entry.date);
          });
        });
      }

      if (profileRes.ok) {
        const d = await profileRes.json();
        username = d.user?.username ?? null;
        avatarUrl = d.user?.avatarUrl ?? null;
      }

      const now = new Date();
      const monthlyCount = Array.from(completedDates).filter((k) => isThisMonth(k, now)).length;

      setData({
        username,
        avatarUrl,
        streak,
        monthlyCount,
        totalEntries: completedDates.size,
        completedDates,
      });
    } catch {
      // silent — banner shows placeholders
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setLoading(false);
      return;
    }
    void fetchData();
  }, [ready, authenticated, fetchData]);

  useEffect(() => {
    const handler = () => { if (authenticated) void fetchData(); };
    window.addEventListener('profileUpdated', handler);
    window.addEventListener('dailyNoteSaved', handler);
    return () => {
      window.removeEventListener('profileUpdated', handler);
      window.removeEventListener('dailyNoteSaved', handler);
    };
  }, [authenticated, fetchData]);

  const lastSevenDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const key = formatDateKey(d);
      return {
        key,
        letter: WEEKDAY_LETTERS[d.getDay()],
        completed: data.completedDates.has(key),
        today: i === 6,
      };
    });
  }, [data.completedDates]);

  const displayName = data.username && !data.username.startsWith('user_') ? data.username : null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??';

  const wroteToday = lastSevenDays[6]?.completed;
  const caption = !authenticated
    ? 'Sign in to track your morning pages and build a daily streak.'
    : data.streak > 0
    ? wroteToday
      ? 'Logged today. Come back tomorrow to keep it going.'
      : 'One page today keeps the streak alive.'
    : 'One page today starts the count.';

  const profileHref = '/profile';

  return (
    <section className={styles.banner} aria-label="Morning pages streak">
      <div className={styles.topRow}>
        <span className={styles.eyebrow}>Morning pages</span>

        <div className={styles.topActions}>
          {authenticated && (
            <Link href={profileHref} className={styles.identityChip} aria-label="Open profile">
              {data.avatarUrl ? (
                <Image
                  src={data.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className={styles.avatar}
                  unoptimized
                />
              ) : (
                <div className={styles.avatarFallback}>{initials}</div>
              )}
              <span className={styles.identityText}>
                <span className={styles.displayName}>{displayName ? `@${displayName}` : 'Your profile'}</span>
                {address && <span className={styles.wallet}>{truncate(address)}</span>}
              </span>
            </Link>
          )}

          {authenticated ? (
            <Link href={profileHref} className={styles.profileLink}>
              View calendar
            </Link>
          ) : (
            <button
              type="button"
              className={styles.profileLink}
              onClick={() => login()}
              disabled={!ready}
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      <div className={styles.mainGrid}>
        <div className={styles.streakCol}>
          <div className={styles.streakValueRow}>
            {loading && authenticated ? (
              <>
                <span className={`${styles.skeletonStreak} ${styles.skeleton}`} />
                <span className={`${styles.skeletonUnit} ${styles.skeleton}`} />
              </>
            ) : (
              <>
                <span className={`${styles.streakValue} ${data.streak > 0 ? styles.streakValueLit : ''}`}>
                  {authenticated ? data.streak : '—'}
                </span>
                <span className={styles.streakUnit}>day streak</span>
              </>
            )}
          </div>

          <p className={styles.caption}>{caption}</p>

          {authenticated && (
            <div className={styles.weekStrip} role="list" aria-label="Last seven days">
              {lastSevenDays.map((d) => (
                <div key={d.key} className={styles.dayCol} role="listitem">
                  <span
                    className={`${styles.dayDot} ${d.completed ? styles.dayDotDone : ''} ${d.today ? styles.dayDotToday : ''}`}
                    title={`${formatShortDate(d.key)}${d.completed ? ' — logged' : ''}`}
                  />
                  <span className={`${styles.dayLetter} ${d.today ? styles.dayLetterToday : ''}`}>
                    {d.letter}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div
          className={`${styles.iconShell} ${data.streak > 0 ? styles.iconShellLit : ''}`}
          aria-hidden="true"
        >
          <Image
            src="/icons/notebook-writing.svg"
            alt=""
            width={72}
            height={72}
            className={styles.notebookIcon}
            priority
          />
        </div>
      </div>

      {authenticated && (
        <div className={styles.footerStats}>
          <span className={styles.footerStat}>
            <strong>{loading ? '—' : data.monthlyCount}</strong> this month
          </span>
          <span className={styles.footerDivider} aria-hidden="true">·</span>
          <span className={styles.footerStat}>
            <strong>{loading ? '—' : data.totalEntries}</strong> total entries
          </span>
        </div>
      )}
    </section>
  );
}
