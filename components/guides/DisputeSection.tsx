'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  Gavel,
  CircleNotch,
  Plus,
  X,
} from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './DisputeSection.module.css';

// Mirrors DISPUTE_TYPES in lib/guide-disputes-db.ts. Kept in-file so this stays
// a lean client bundle (no server-only import).
const DISPUTE_TYPES = [
  'factual',
  'cross_niche',
  'verification_appeal',
  'rereview_appeal',
] as const;

type DisputeType = (typeof DISPUTE_TYPES)[number];

const DISPUTE_TYPE_LABELS: Record<DisputeType, string> = {
  factual: 'Factual error',
  cross_niche: 'Spans two niches',
  verification_appeal: 'Appeal the verification',
  rereview_appeal: 'Appeal the re-review',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  panel_drawn: 'In review',
  resolved_upheld: 'Upheld',
  resolved_overturned: 'Overturned',
  resolved_forked: 'Forked',
  dismissed: 'Dismissed',
};

const RESOLVED_STATUSES = new Set([
  'resolved_upheld',
  'resolved_overturned',
  'resolved_forked',
  'dismissed',
]);

const MIN_EVIDENCE_LENGTH = 80;

interface Dispute {
  id: string;
  guideId: string;
  openerId: string;
  disputeType: DisputeType;
  evidence: string;
  status: string;
  resolutionNote: string | null;
  openerUsername: string | null;
  voteCount: number;
  createdAt: string;
}

interface Props {
  /** Guide id whose disputes are displayed. */
  guideId: string;
  /** Optional call-to-action rendered at the foot of the section (e.g. the
      guide page's Edit & Improve button — improving a guide is the
      constructive counterpart to disputing it). */
  footerAction?: ReactNode;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function statusClass(status: string): string {
  if (status === 'resolved_forked') return styles.status_forked;
  if (status === 'resolved_overturned') return styles.status_overturned;
  if (status === 'resolved_upheld') return styles.status_upheld;
  if (status === 'dismissed') return styles.status_dismissed;
  return styles.status_open;
}

/**
 * Public dispute panel for a guide: lists every dispute (type, status,
 * resolution note) and — for signed-in users — an "Open dispute" form.
 *
 * Self-fetching and standalone. The reviewer wires it into the guide page — it
 * is NOT imported by app/home/guides/[slug]/page.tsx here.
 */
export default function DisputeSection({ guideId, footerAction }: Props) {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();

  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [disputeType, setDisputeType] = useState<DisputeType | ''>('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/guides/disputes?guideId=${encodeURIComponent(guideId)}`,
        { cache: 'no-store' },
      );
      if (!res.ok) {
        setLoadError('Could not load disputes.');
        return;
      }
      const json = await res.json();
      setDisputes(Array.isArray(json.disputes) ? json.disputes : []);
      setLoadError(null);
    } catch {
      setLoadError('Could not load disputes.');
    } finally {
      setLoading(false);
    }
  }, [guideId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggleForm = () => {
    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }
    setFormError(null);
    play('click');
    setFormOpen((open) => !open);
  };

  const handleSubmit = useCallback(async () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!disputeType) {
      play('error');
      setFormError('Pick a dispute type.');
      return;
    }
    if (evidence.trim().length < MIN_EVIDENCE_LENGTH) {
      play('error');
      setFormError(`Evidence must be at least ${MIN_EVIDENCE_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const headers = { 'Content-Type': 'application/json', ...(await authHeaders()) };
      const res = await fetch('/api/guides/disputes', {
        method: 'POST',
        headers,
        body: JSON.stringify({ guideId, disputeType, evidence: evidence.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        play('error');
        setFormError(data.error ?? 'Could not open the dispute.');
        return;
      }
      play('success');
      setFormOpen(false);
      setDisputeType('');
      setEvidence('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }, [authenticated, login, disputeType, evidence, authHeaders, guideId, load, play]);

  const evidenceRemaining = MIN_EVIDENCE_LENGTH - evidence.trim().length;

  return (
    <section className={styles.wrapper} aria-label="Disputes">
      <header className={styles.header}>
        <Gavel size={18} weight="fill" className={styles.headerIcon} />
        <h2 className={styles.title}>Disputes</h2>
        <button
          type="button"
          className={`${styles.openBtn} ${formOpen ? styles.openBtnActive : ''}`}
          onMouseEnter={() => play('soft-hover')}
          onClick={handleToggleForm}
          disabled={submitting}
          aria-expanded={formOpen}
        >
          {formOpen ? <X size={14} weight="bold" /> : <Plus size={14} weight="bold" />}
          <span>{formOpen ? 'Cancel' : 'Open dispute'}</span>
        </button>
      </header>

      {formOpen && (
        <div className={styles.form} role="dialog" aria-label="Open a dispute">
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Dispute type</span>
            <select
              className={styles.select}
              value={disputeType}
              onChange={(e) => setDisputeType(e.target.value as DisputeType)}
            >
              <option value="">Select a type…</option>
              {DISPUTE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {DISPUTE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Evidence (required)</span>
            <textarea
              className={styles.textarea}
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={5}
              placeholder="Lay out your case with specifics — what is wrong, and how you know."
            />
            <span className={styles.hint}>
              {evidenceRemaining > 0
                ? `${evidenceRemaining} more character${evidenceRemaining === 1 ? '' : 's'} needed`
                : 'Ready to submit'}
            </span>
          </label>

          {formError && <p className={styles.error}>{formError}</p>}

          <button
            type="button"
            className={styles.submitBtn}
            onMouseEnter={() => play('soft-hover')}
            onClick={handleSubmit}
            disabled={submitting || !disputeType || evidence.trim().length < MIN_EVIDENCE_LENGTH}
          >
            {submitting ? 'Opening…' : 'Open dispute'}
          </button>
        </div>
      )}

      {loading ? (
        <div className={styles.state}>
          <CircleNotch size={18} className={styles.spinner} />
          <span>Loading disputes…</span>
        </div>
      ) : loadError ? (
        <div className={styles.stateError}>{loadError}</div>
      ) : disputes.length === 0 ? (
        <div className={styles.state}>No disputes have been opened on this guide.</div>
      ) : (
        <ul className={styles.list}>
          {disputes.map((d) => (
            <li
              key={d.id}
              className={styles.dispute}
              onMouseEnter={() => play('soft-hover')}
            >
              <div className={styles.disputeHead}>
                <span className={styles.typeChip}>
                  {DISPUTE_TYPE_LABELS[d.disputeType] ?? d.disputeType}
                </span>
                <span className={`${styles.statusPill} ${statusClass(d.status)}`}>
                  {STATUS_LABELS[d.status] ?? d.status}
                </span>
                <span className={styles.opener}>{d.openerUsername ?? 'Member'}</span>
                <span className={styles.date}>{formatDate(d.createdAt)}</span>
              </div>
              <p className={styles.evidence}>{d.evidence}</p>
              {RESOLVED_STATUSES.has(d.status) && d.resolutionNote && (
                <p className={styles.resolution}>{d.resolutionNote}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {footerAction && <div className={styles.footerAction}>{footerAction}</div>}
    </section>
  );
}
