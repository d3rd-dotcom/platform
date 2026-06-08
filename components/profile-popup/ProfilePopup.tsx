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

interface RereadNote {
  date: string;
  content: string;
  day: number;
  weekNumber: number;
}

interface RereadModalState {
  dateKey: string;
  isLoading: boolean;
  error: string | null;
  note: RereadNote | null;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const MONTH_LABEL = new Intl.DateTimeFormat('en-US', { month: 'long' });
const YEAR_LABEL = new Intl.DateTimeFormat('en-US', { year: 'numeric' });
const FULL_DATE_LABEL = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});
const REREAD_SHARD_COST = 50;

function formatReadableDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return FULL_DATE_LABEL.format(new Date(year, month - 1, day));
}

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
  const [rereadModal, setRereadModal] = useState<RereadModalState | null>(null);

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
      if (e.key !== 'Escape') return;
      if (rereadModal) {
        if (!rereadModal.isLoading) setRereadModal(null);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose, rereadModal]);

  const openRereadModal = useCallback((dateKey: string) => {
    setRereadModal({ dateKey, isLoading: false, error: null, note: null });
  }, []);

  const unlockReread = useCallback(async () => {
    if (!rereadModal || rereadModal.note) return;

    setRereadModal((prev) => (prev ? { ...prev, isLoading: true, error: null } : prev));

    try {
      const token = await getAccessToken();
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/daily-notes/reread', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ date: rereadModal.dateKey }),
      });

      const resData = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMessage = resData?.error === 'insufficient_shards'
          ? `You need ${REREAD_SHARD_COST} diamonds to reread this page.`
          : resData?.error === 'note_not_found'
            ? 'This morning page is no longer available to reread.'
            : 'The reread could not be opened right now.';

        setRereadModal((prev) => (prev ? { ...prev, isLoading: false, error: errorMessage } : prev));
        return;
      }

      if (typeof resData?.shardsRemaining === 'number') {
        setData((prev) => ({ ...prev, shardCount: resData.shardsRemaining }));
        window.dispatchEvent(new Event('shardsUpdated'));
      }

      setRereadModal((prev) => (
        prev ? { ...prev, isLoading: false, error: null, note: resData.note ?? null } : prev
      ));
    } catch {
      setRereadModal((prev) => (
        prev ? { ...prev, isLoading: false, error: 'The reread could not be opened right now.' } : prev
      ));
    }
  }, [getAccessToken, rereadModal]);

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
              const isRereadable = day.completed && day.inMonth;
              const cls = [
                styles.dayCell,
                !day.inMonth && styles.dayCellOut,
                day.today && styles.dayCellToday,
                isRereadable && styles.dayCellDone,
                isRereadable && styles.dayCellInteractive,
              ].filter(Boolean).join(' ');

              if (!isRereadable) {
                return (
                  <div key={day.dateKey} className={cls}>
                    <span className={styles.dayNum}>{day.date.getDate()}</span>
                  </div>
                );
              }

              return (
                <button
                  key={day.dateKey}
                  type="button"
                  className={cls}
                  onClick={() => openRereadModal(day.dateKey)}
                  aria-label={`Reread morning page for ${formatReadableDate(day.dateKey)}`}
                  title={`Reread ${formatReadableDate(day.dateKey)} for ${REREAD_SHARD_COST} diamonds`}
                >
                  <span className={styles.dayNum}>{day.date.getDate()}</span>
                  <span className={styles.dot} />
                </button>
              );
            })}
          </div>

          {loading && <div className={styles.loadingBar} aria-label="Loading calendar data" />}

          <p className={styles.calendarHint}>Tap a completed day to reread it for {REREAD_SHARD_COST} diamonds.</p>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
          <span className={styles.footerText}>{loading ? '—' : data.shardCount{} diamonds</span>
        </div>

      </div>
    </div>
  );

  const selectedDateLabel = rereadModal ? formatReadableDate(rereadModal.dateKey) : '';

  const rereadOverlay = rereadModal ? (
    <div
      className={styles.rereadOverlay}
      onClick={() => {
        if (!rereadModal.isLoading) setRereadModal(null);
      }}
    >
      <div
        className={styles.rereadModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="popup-reread-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.rereadClose}
          onClick={() => setRereadModal(null)}
          aria-label="Close reread note"
          disabled={rereadModal.isLoading}
        >
          <X size={16} weight="bold" />
        </button>

        <div className={styles.rereadEyebrow}>Morning Pages Archive</div>
        <h3 id="popup-reread-title" className={styles.rereadTitle}>{selectedDateLabel}</h3>

        {rereadModal.note ? (
          <>
            <p className={styles.rereadMeta}>
              Week {rereadModal.note.weekNumber}, Day {rereadModal.note.day}
            </p>
            <div className={styles.noteFrame}>
              <p className={styles.noteContent}>{rereadModal.note.content}</p>
            </div>
            <div className={styles.rereadFooter}>
              <span className={styles.rereadBalance}>{data.shardCount} diamonds remaining</span>
              <button type="button" className={styles.rereadPrimary} onClick={() => setRereadModal(null)}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.rereadCopy}>
              Spend {REREAD_SHARD_COST} diamonds to reopen this completed morning page. Access lasts for this view only.
            </p>
            <div className={styles.rereadCostRow}>
              <span className={styles.rereadCostBadge}>
                <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} />
                {REREAD_SHARD_COST} diamonds
              </span>
              <span className={styles.rereadBalance}>{data.shardCount} available</span>
            </div>
            {rereadModal.error && (
              <p className={styles.rereadError} role="alert">{rereadModal.error}</p>
            )}
            <div className={styles.rereadActions}>
              <button
                type="button"
                className={styles.rereadSecondary}
                onClick={() => setRereadModal(null)}
                disabled={rereadModal.isLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.rereadPrimary}
                onClick={unlockReread}
                disabled={rereadModal.isLoading}
              >
                {rereadModal.isLoading ? 'Opening...' : `Spend ${REREAD_SHARD_COST} diamonds`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  ) : null;

  if (typeof window === 'undefined') return null;
  return createPortal(
    <>
      {popup}
      {rereadOverlay}
    </>,
    document.body
  );
}
