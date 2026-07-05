'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  ThumbsUp,
  ThumbsDown,
  CircleNotch,
  X,
} from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './GuideVoteBar.module.css';

// Kept in-file (no import from lib/guide-votes-db) so this stays a lean client
// bundle — the labels mirror RUBRIC_LABELS there.
const RUBRIC_REASONS = [
  'unclear',
  'factually_wrong',
  'missing_step',
  'outdated',
  'broken_link',
  'prereq_gap',
  'wrong_level',
  'scope_creep',
] as const;

type RubricReason = (typeof RUBRIC_REASONS)[number];

const RUBRIC_LABELS: Record<RubricReason, string> = {
  unclear: 'Unclear or confusing',
  factually_wrong: 'Factually wrong',
  missing_step: 'Missing a step',
  outdated: 'Out of date',
  broken_link: 'Broken link',
  prereq_gap: 'Prerequisite gap',
  wrong_level: 'Wrong difficulty level',
  scope_creep: 'Off-topic / scope creep',
};

interface Totals {
  up: number;
  down: number;
}

interface Props {
  slug: string;
  /**
   * Section titles from the guide body, so a downvoter can optionally pinpoint a
   * section. The stored section_pointer is the title string.
   */
  sectionTitles?: string[];
}

export default function GuideVoteBar({ slug, sectionTitles = [] }: Props) {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();
  const [totals, setTotals] = useState<Totals>({ up: 0, down: 0 });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Downvote rubric picker state.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reason, setReason] = useState<RubricReason | ''>('');
  const [section, setSection] = useState('');

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const loadTotals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guides/${slug}/vote`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.totals) setTotals(data.totals);
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    loadTotals();
  }, [loadTotals]);

  const submitVote = useCallback(
    async (direction: 'up' | 'down', rubricReason?: RubricReason, sectionPointer?: string) => {
      if (!ready) return;
      if (!authenticated) {
        login();
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
        const res = await fetch(`/api/guides/${slug}/vote`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            direction,
            ...(rubricReason ? { rubricReason } : {}),
            ...(sectionPointer ? { sectionPointer } : {}),
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          play('error');
          setError(data.error ?? 'Could not record your vote.');
          return;
        }
        play('success');
        if (data.totals) setTotals(data.totals);
        setPickerOpen(false);
        setReason('');
        setSection('');
      } finally {
        setSubmitting(false);
      }
    },
    [ready, authenticated, login, authHeaders, slug, play],
  );

  const handleUpvote = () => submitVote('up');

  const handleDownvoteClick = () => {
    if (!authenticated) {
      login();
      return;
    }
    setError(null);
    play('click');
    setPickerOpen((open) => !open);
  };

  const handleSubmitDownvote = () => {
    if (!reason) {
      play('error');
      setError('Pick a reason to downvote.');
      return;
    }
    submitVote('down', reason, section || undefined);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.bar}>
        <button
          type="button"
          className={styles.voteBtn}
          onMouseEnter={() => play('soft-hover')}
          onClick={handleUpvote}
          disabled={submitting}
          aria-label="Upvote this guide"
        >
          <ThumbsUp size={18} weight="bold" />
          <span className={styles.count}>{loading ? '–' : totals.up}</span>
        </button>

        <button
          type="button"
          className={`${styles.voteBtn} ${pickerOpen ? styles.voteBtnActive : ''}`}
          onMouseEnter={() => play('soft-hover')}
          onClick={handleDownvoteClick}
          disabled={submitting}
          aria-expanded={pickerOpen}
          aria-label="Downvote this guide"
        >
          <ThumbsDown size={18} weight="bold" />
          <span className={styles.count}>{loading ? '–' : totals.down}</span>
        </button>

        {submitting && <CircleNotch size={16} className={styles.spinner} />}
      </div>

      {error && !pickerOpen && <p className={styles.error}>{error}</p>}

      {pickerOpen && (
        <div className={styles.picker} role="dialog" aria-label="Downvote reason">
          <div className={styles.pickerHead}>
            <span className={styles.pickerTitle}>Why the downvote?</span>
            <button
              type="button"
              className={styles.pickerClose}
              onMouseEnter={() => play('soft-hover')}
              onClick={() => {
                play('click');
                setPickerOpen(false);
              }}
              aria-label="Cancel downvote"
            >
              <X size={14} weight="bold" />
            </button>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Reason (required)</span>
            <select
              className={styles.select}
              value={reason}
              onChange={(e) => setReason(e.target.value as RubricReason)}
            >
              <option value="">Select a reason…</option>
              {RUBRIC_REASONS.map((r) => (
                <option key={r} value={r}>
                  {RUBRIC_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          {sectionTitles.length > 0 && (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Section (optional)</span>
              <select
                className={styles.select}
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">Whole guide</option>
                {sectionTitles.map((title) => (
                  <option key={title} value={title}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.submitBtn}
            onMouseEnter={() => play('soft-hover')}
            onClick={handleSubmitDownvote}
            disabled={submitting || !reason}
          >
            {submitting ? 'Recording…' : 'Submit downvote'}
          </button>
        </div>
      )}
    </div>
  );
}
