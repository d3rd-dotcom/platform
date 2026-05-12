'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { usePrivy } from '@privy-io/react-auth';
import { CaretLeft, CaretRight, X } from '@phosphor-icons/react';
import styles from './ProfilePopup.module.css';

interface ProfilePopupProps {
  username: string | null;
  avatarUrl: string | null;
  address: string | undefined;
  onClose: () => void;
}

interface PopupData {
  streak: number;
  completedDates: Set<string>;
  shardCount: number;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long' });
const YEAR_LABEL = new Intl.DateTimeFormat('en-US', { year: 'numeric' });

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePopup({ username, avatarUrl, address, onClose }: ProfilePopupProps) {
  const { getAccessToken } = usePrivy();
  const [data, setData] = useState<PopupData>({ streak: 0, completedDates: new Set(), shardCount: 0 });
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));

  const displayName = username && !username.startsWith('user_') ? username : null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??';

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
      let completedDates = new Set<string>();
      let shardCount = 0;

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
        shardCount = d.user?.shardCount ?? 0;
      }

      setData({ streak, completedDates, shardCount });
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const todayKey = formatDateKey(new Date());

    return Array.from({ length: 35 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const dateKey = formatDateKey(date);
      return {
        date,
        dateKey,
        inMonth: isSameMonth(date, currentMonth),
        completed: data.completedDates.has(dateKey),
        today: dateKey === todayKey,
      };
    });
  }, [currentMonth, data.completedDates]);

  const monthlyCount = calendarDays.filter((d) => d.inMonth && d.completed).length;
  const monthStr = MONTH_LABEL.format(currentMonth);
  const yearStr = YEAR_LABEL.format(currentMonth);

  const popup = (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>

        <button className={styles.closeBtn} onClick={onClose} type="button" aria-label="Close">
          <X size={14} weight="bold" />
        </button>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.avatarWrap}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName || 'Profile'} width={48} height={48} className={styles.avatar} unoptimized />
            ) : (
              <div className={styles.avatarFallback}>{initials}</div>
            )}
          </div>
          <div className={styles.identity}>
            <span className={styles.displayName}>{displayName ? `@${displayName}` : 'Not connected'}</span>
            {address && <span className={styles.wallet}>{truncate(address)}</span>}
          </div>
        </div>

        {/* Stats row */}
        <div className={styles.statsRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{loading ? '—' : data.streak}</span>
            <span className={styles.statLabel}>day streak</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{loading ? '—' : monthlyCount}</span>
            <span className={styles.statLabel}>this month</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={styles.statValue}>{loading ? '—' : data.completedDates.size}</span>
            <span className={styles.statLabel}>total entries</span>
          </div>
        </div>

        {/* Calendar */}
        <div className={styles.calendarSection}>
          <div className={styles.calendarHeader}>
            <div className={styles.calendarMonth}>
              <span className={styles.calendarMonthDay}>{monthStr}</span>
              <span className={styles.calendarMonthYear}>{yearStr}</span>
            </div>
            <div className={styles.calendarNav}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                aria-label="Previous month"
              >
                <CaretLeft size={12} weight="bold" />
              </button>
              <button
                type="button"
                className={styles.navBtn}
                onClick={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                aria-label="Next month"
              >
                <CaretRight size={12} weight="bold" />
              </button>
            </div>
          </div>

          <div className={styles.calendarGrid}>
            {WEEKDAY_LABELS.map((l) => (
              <div key={l} className={styles.weekLabel}>{l}</div>
            ))}

            {calendarDays.map((day) => {
              const cls = [
                styles.dayCell,
                !day.inMonth && styles.dayCellOut,
                day.today && styles.dayCellToday,
                day.completed && day.inMonth && styles.dayCellDone,
              ].filter(Boolean).join(' ');

              return (
                <div key={day.dateKey} className={cls}>
                  <span className={styles.dayNum}>{day.date.getDate()}</span>
                  {day.completed && day.inMonth && <span className={styles.dot} />}
                </div>
              );
            })}
          </div>

          {loading && <div className={styles.loadingBar} aria-label="Loading calendar data" />}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
          <span className={styles.footerText}>{loading ? '—' : data.shardCount} shards</span>
        </div>

      </div>
    </div>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(popup, document.body);
}
