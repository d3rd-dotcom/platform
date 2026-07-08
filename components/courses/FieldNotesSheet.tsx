'use client';

import React, { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './FieldNotesSheet.module.css';

interface LedgerEntry {
  date: string;
  content: string;
  day: number;
  weekNumber: number;
  submittedAt: number | null;
}

interface FieldNotesSheetProps {
  onClose: () => void;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function truncate(text: string, max = 160): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + '...';
}

export default function FieldNotesSheet({ onClose }: FieldNotesSheetProps) {
  const { play } = useSound();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/daily-notes');
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const allPages: Record<string, LedgerEntry[]> = data.allWeekPages ?? {};
        const all: LedgerEntry[] = [];
        for (const [week, pages] of Object.entries(allPages)) {
          if (Array.isArray(pages)) {
            for (const p of pages) {
              all.push({ ...p, weekNumber: Number(week) });
            }
          }
        }
        all.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
        setEntries(all);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheetStage} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => { play('click'); onClose(); }}
          onMouseEnter={() => play('soft-hover')}
          aria-label="Close"
        >
          <X size={18} weight="bold" />
        </button>

        <div className={styles.stackSheet} aria-hidden="true" />
        <div className={`${styles.stackSheet} ${styles.stackSheetTwo}`} aria-hidden="true" />

        <div className={styles.sheet}>
          <div className={styles.ledgerHeader}>
            <span className={styles.ledgerTitle}>Field Notes</span>
            <span className={styles.ledgerCount}>
              {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
            </span>
          </div>

          <div className={styles.ledgerList}>
            {loading ? (
              <div className={styles.ledgerEmpty}>Loading...</div>
            ) : entries.length === 0 ? (
              <div className={styles.ledgerEmpty}>
                No field notes yet. Write daily reflections to earn diamonds.
              </div>
            ) : (
              entries.map((entry, i) => (
                <div key={`${entry.date}-${i}`} className={styles.ledgerRow}>
                  <div className={styles.ledgerRowMeta}>
                    <span className={styles.ledgerRowDate}>{formatDate(entry.date)}</span>
                    <span className={styles.ledgerRowWeek}>W{entry.weekNumber} D{entry.day}</span>
                  </div>
                  <div className={styles.ledgerRowContent}>{truncate(entry.content)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
