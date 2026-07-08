'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  Gavel,
  Scales,
  CircleNotch,
  CheckCircle,
  XCircle,
  ArrowSquareOut,
} from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './VerifierPanelQueue.module.css';

/**
 * "Your panels" — the verifier's personal assignment queue.
 *
 * Lists verification panels and dispute panels the signed-in user was drawn onto,
 * with an inline voting form per open assignment, and shows recently resolved ones
 * so members can see how the juries they served on turned out. This is the missing
 * UI that lets the human verification jury actually vote — the vote endpoints
 * (POST /api/guides/verification/vote and /api/guides/disputes/vote) already exist.
 *
 * Self-fetching and standalone. Membership + one-vote-per-member + the 40-char
 * justification minimum are all enforced server-side; the form mirrors those rules
 * so the member gets fast, clean feedback.
 */

// Mirrors RUBRIC_ITEMS in lib/guide-verification-db.ts (kept in-file for a lean
// client bundle — no server-only import).
const RUBRIC_ITEMS = [
  'hierarchy_soundness',
  'obvious_errors',
  'duplication',
  'scope',
] as const;
type RubricItem = (typeof RUBRIC_ITEMS)[number];

const RUBRIC_LABELS: Record<RubricItem, string> = {
  hierarchy_soundness: 'Hierarchy soundness',
  obvious_errors: 'Obvious errors',
  duplication: 'Duplication',
  scope: 'Scope',
};

// Mirrors DISPUTE_VERDICTS in lib/guide-disputes-db.ts.
const DISPUTE_VERDICTS = ['uphold', 'overturn', 'fork', 'dismiss'] as const;
type DisputeVerdict = (typeof DISPUTE_VERDICTS)[number];

const VERDICT_LABELS: Record<DisputeVerdict, string> = {
  uphold: 'Uphold the dispute',
  overturn: 'Overturn the guide',
  fork: 'Fork into a spin-off',
  dismiss: 'Dismiss the dispute',
};

const DISPUTE_TYPE_LABELS: Record<string, string> = {
  factual: 'Factual error',
  cross_niche: 'Spans two niches',
  verification_appeal: 'Appeal the verification',
  rereview_appeal: 'Appeal the re-review',
};

const PANEL_STATUS_LABELS: Record<string, string> = {
  open: 'In review',
  approved: 'Approved',
  rejected: 'Sent back',
};

const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: 'Awaiting panel',
  panel_drawn: 'In review',
  resolved_upheld: 'Upheld',
  resolved_overturned: 'Overturned',
  resolved_forked: 'Forked',
  dismissed: 'Dismissed',
};

const MIN_JUSTIFICATION_LENGTH = 40;

interface PanelAssignment {
  panelId: string;
  guideId: string;
  guideSlug: string;
  guideTitle: string;
  status: 'open' | 'approved' | 'rejected';
  createdAt: string;
  hasVoted: boolean;
  myDecision: 'approve' | 'reject' | null;
  myRubricItem: RubricItem | null;
  voteCount: number;
  creScore: number | null;
  evidenceCriteria: string[];
}

interface DisputeAssignment {
  disputeId: string;
  guideId: string;
  guideSlug: string;
  guideTitle: string;
  disputeType: string;
  evidence: string;
  status: string;
  resolutionNote: string | null;
  openerUsername: string | null;
  createdAt: string;
  hasVoted: boolean;
  myVerdict: DisputeVerdict | null;
  voteCount: number;
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

function panelStatusClass(status: string): string {
  if (status === 'approved') return styles.status_approved;
  if (status === 'rejected') return styles.status_rejected;
  return styles.status_open;
}

function disputeStatusClass(status: string): string {
  if (status === 'resolved_forked') return styles.status_forked;
  if (status === 'resolved_overturned') return styles.status_rejected;
  if (status === 'resolved_upheld') return styles.status_approved;
  if (status === 'dismissed') return styles.status_dismissed;
  return styles.status_open;
}

// ── Verification-panel voting form ────────────────────────────────────────────

function VerificationCard({
  panel,
  authHeaders,
  onResolved,
}: {
  panel: PanelAssignment;
  authHeaders: () => Promise<HeadersInit>;
  onResolved: () => void;
}) {
  const { play } = useSound();
  const [decision, setDecision] = useState<'approve' | 'reject' | ''>('');
  const [rubricItem, setRubricItem] = useState<RubricItem | ''>('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MIN_JUSTIFICATION_LENGTH - justification.trim().length;
  const ready = !!decision && !!rubricItem && remaining <= 0;

  const submit = useCallback(async () => {
    if (!decision) {
      play('error');
      setError('Choose approve or reject.');
      return;
    }
    if (!rubricItem) {
      play('error');
      setError('Cite one rubric item.');
      return;
    }
    if (justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
      play('error');
      setError(`Your justification needs at least ${MIN_JUSTIFICATION_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/guides/verification/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          panelId: panel.panelId,
          decision,
          rubricItem,
          justification: justification.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        play('error');
        setError(data.error ?? 'Could not record your vote.');
        return;
      }
      play('success');
      onResolved();
    } finally {
      setSubmitting(false);
    }
  }, [decision, rubricItem, justification, panel.panelId, authHeaders, onResolved, play]);

  const votable = panel.status === 'open' && !panel.hasVoted;

  return (
    <article className={styles.card} onMouseEnter={() => play('soft-hover')}>
      <div className={styles.cardHead}>
        <span className={styles.kindChip}>Verification</span>
        <span className={`${styles.statusPill} ${panelStatusClass(panel.status)}`}>
          {PANEL_STATUS_LABELS[panel.status] ?? panel.status}
        </span>
        <span className={styles.date}>{formatDate(panel.createdAt)}</span>
      </div>

      <Link
        href={`/courses/guides/${panel.guideSlug}`}
        className={styles.guideLink}
        onMouseEnter={() => play('soft-hover')}
        onClick={() => play('navigation')}
      >
        <span className={styles.guideTitle}>{panel.guideTitle}</span>
        <ArrowSquareOut size={15} weight="bold" className={styles.linkIcon} />
      </Link>

      <p className={styles.meta}>
        {panel.creScore != null && (
          <span className={styles.metaItem}>CRE advisory {panel.creScore}/100</span>
        )}
        <span className={styles.metaItem}>
          {panel.voteCount} vote{panel.voteCount === 1 ? '' : 's'} cast
        </span>
      </p>

      {panel.evidenceCriteria.length > 0 && (
        <div className={styles.criteria}>
          <span className={styles.criteriaLabel}>What a learner should be able to do</span>
          <ul className={styles.criteriaList}>
            {panel.evidenceCriteria.map((c, i) => (
              <li key={i} className={styles.criteriaItem}>{c}</li>
            ))}
          </ul>
          <span className={styles.criteriaNote}>
            Weigh these against the guide when you judge scope and soundness.
          </span>
        </div>
      )}

      {votable ? (
        <div className={styles.form}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>Your decision</span>
            <div className={styles.choiceRow}>
              <button
                type="button"
                className={`${styles.choice} ${decision === 'approve' ? styles.choiceApprove : ''}`}
                onMouseEnter={() => play('soft-hover')}
                onClick={() => {
                  play('click');
                  setDecision('approve');
                }}
                aria-pressed={decision === 'approve'}
              >
                <CheckCircle size={16} weight="fill" /> Approve
              </button>
              <button
                type="button"
                className={`${styles.choice} ${decision === 'reject' ? styles.choiceReject : ''}`}
                onMouseEnter={() => play('soft-hover')}
                onClick={() => {
                  play('click');
                  setDecision('reject');
                }}
                aria-pressed={decision === 'reject'}
              >
                <XCircle size={16} weight="fill" /> Reject
              </button>
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Rubric item</span>
            <select
              className={styles.select}
              value={rubricItem}
              onChange={(e) => setRubricItem(e.target.value as RubricItem)}
            >
              <option value="">Select a rubric item…</option>
              {RUBRIC_ITEMS.map((r) => (
                <option key={r} value={r}>
                  {RUBRIC_LABELS[r]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Justification (required)</span>
            <textarea
              className={styles.textarea}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              placeholder="Explain your call against the rubric item — specifics, not vibes."
            />
            <span className={styles.hint}>
              {remaining > 0
                ? `${remaining} more character${remaining === 1 ? '' : 's'} needed`
                : 'Ready to submit'}
            </span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.submitBtn}
            onMouseEnter={() => play('soft-hover')}
            onClick={submit}
            disabled={submitting || !ready}
          >
            {submitting ? 'Recording…' : 'Cast vote'}
          </button>
        </div>
      ) : panel.hasVoted ? (
        <p className={styles.voted}>
          {panel.myDecision === 'approve' ? (
            <CheckCircle size={15} weight="fill" className={styles.votedApprove} />
          ) : (
            <XCircle size={15} weight="fill" className={styles.votedReject} />
          )}
          You voted to {panel.myDecision}
          {panel.myRubricItem ? ` on ${RUBRIC_LABELS[panel.myRubricItem]}` : ''}.
        </p>
      ) : (
        <p className={styles.voted}>
          This panel resolved before you voted — no action needed.
        </p>
      )}
    </article>
  );
}

// ── Dispute-panel voting form ─────────────────────────────────────────────────

function DisputeCard({
  dispute,
  authHeaders,
  onResolved,
}: {
  dispute: DisputeAssignment;
  authHeaders: () => Promise<HeadersInit>;
  onResolved: () => void;
}) {
  const { play } = useSound();
  const [verdict, setVerdict] = useState<DisputeVerdict | ''>('');
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remaining = MIN_JUSTIFICATION_LENGTH - justification.trim().length;
  const ready = !!verdict && remaining <= 0;

  const submit = useCallback(async () => {
    if (!verdict) {
      play('error');
      setError('Choose a verdict.');
      return;
    }
    if (justification.trim().length < MIN_JUSTIFICATION_LENGTH) {
      play('error');
      setError(`Your justification needs at least ${MIN_JUSTIFICATION_LENGTH} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/guides/disputes/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({
          disputeId: dispute.disputeId,
          verdict,
          justification: justification.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        play('error');
        setError(data.error ?? 'Could not record your verdict.');
        return;
      }
      play('success');
      onResolved();
    } finally {
      setSubmitting(false);
    }
  }, [verdict, justification, dispute.disputeId, authHeaders, onResolved, play]);

  const votable = dispute.status === 'panel_drawn' && !dispute.hasVoted;

  return (
    <article className={styles.card} onMouseEnter={() => play('soft-hover')}>
      <div className={styles.cardHead}>
        <span className={styles.kindChipDispute}>Dispute</span>
        <span className={`${styles.statusPill} ${disputeStatusClass(dispute.status)}`}>
          {DISPUTE_STATUS_LABELS[dispute.status] ?? dispute.status}
        </span>
        <span className={styles.date}>{formatDate(dispute.createdAt)}</span>
      </div>

      <Link
        href={`/courses/guides/${dispute.guideSlug}`}
        className={styles.guideLink}
        onMouseEnter={() => play('soft-hover')}
        onClick={() => play('navigation')}
      >
        <span className={styles.guideTitle}>{dispute.guideTitle}</span>
        <ArrowSquareOut size={15} weight="bold" className={styles.linkIcon} />
      </Link>

      <p className={styles.meta}>
        <span className={styles.metaItem}>
          {DISPUTE_TYPE_LABELS[dispute.disputeType] ?? dispute.disputeType}
        </span>
        <span className={styles.metaItem}>Opened by {dispute.openerUsername ?? 'a member'}</span>
        <span className={styles.metaItem}>
          {dispute.voteCount} verdict{dispute.voteCount === 1 ? '' : 's'} cast
        </span>
      </p>

      <p className={styles.evidence}>{dispute.evidence}</p>

      {votable ? (
        <div className={styles.form}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Your verdict</span>
            <select
              className={styles.select}
              value={verdict}
              onChange={(e) => setVerdict(e.target.value as DisputeVerdict)}
            >
              <option value="">Select a verdict…</option>
              {DISPUTE_VERDICTS.map((v) => (
                <option key={v} value={v}>
                  {VERDICT_LABELS[v]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>Justification (required)</span>
            <textarea
              className={styles.textarea}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              placeholder="Explain your verdict — weigh the evidence and say why."
            />
            <span className={styles.hint}>
              {remaining > 0
                ? `${remaining} more character${remaining === 1 ? '' : 's'} needed`
                : 'Ready to submit'}
            </span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="button"
            className={styles.submitBtn}
            onMouseEnter={() => play('soft-hover')}
            onClick={submit}
            disabled={submitting || !ready}
          >
            {submitting ? 'Recording…' : 'Cast verdict'}
          </button>
        </div>
      ) : dispute.hasVoted ? (
        <p className={styles.voted}>
          You voted to {dispute.myVerdict}.
          {dispute.resolutionNote ? ` ${dispute.resolutionNote}` : ''}
        </p>
      ) : (
        <p className={styles.voted}>
          {dispute.resolutionNote ?? 'This dispute resolved before you voted — no action needed.'}
        </p>
      )}
    </article>
  );
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export default function VerifierPanelQueue() {
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();

  const [panels, setPanels] = useState<PanelAssignment[]>([]);
  const [disputes, setDisputes] = useState<DisputeAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken().catch(() => null);
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const headers = await authHeaders();
      const [pRes, dRes] = await Promise.all([
        fetch('/api/guides/verification/panels', { cache: 'no-store', headers }),
        fetch('/api/guides/disputes/panels', { cache: 'no-store', headers }),
      ]);
      if (pRes.ok) {
        const data = await pRes.json();
        setPanels(Array.isArray(data.panels) ? data.panels : []);
      }
      if (dRes.ok) {
        const data = await dRes.json();
        setDisputes(Array.isArray(data.disputes) ? data.disputes : []);
      }
      if (!pRes.ok && !dRes.ok) {
        setLoadError('Could not load your panels.');
      }
    } catch {
      setLoadError('Could not load your panels.');
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready) return;
    if (authenticated) load();
    else setLoading(false);
  }, [ready, authenticated, load]);

  const pendingCount = useMemo(
    () =>
      panels.filter((p) => p.status === 'open' && !p.hasVoted).length +
      disputes.filter((d) => d.status === 'panel_drawn' && !d.hasVoted).length,
    [panels, disputes],
  );

  const hasAny = panels.length > 0 || disputes.length > 0;

  return (
    <section className={styles.wrapper} aria-label="Your verification panels">
      <header className={styles.header}>
        <Scales size={18} weight="fill" className={styles.headerIcon} />
        <h2 className={styles.title}>Your panels</h2>
        {pendingCount > 0 && (
          <span className={styles.countPill}>
            {pendingCount} awaiting your vote
          </span>
        )}
      </header>

      {!ready || loading ? (
        <div className={styles.state}>
          <CircleNotch size={16} className={styles.spinner} />
          <span>Loading your panels…</span>
        </div>
      ) : !authenticated ? (
        <div className={styles.state}>
          <button
            type="button"
            className={styles.linkBtn}
            onMouseEnter={() => play('soft-hover')}
            onClick={() => login()}
          >
            Sign in
          </button>
          <span>to see the panels you were drawn onto.</span>
        </div>
      ) : loadError ? (
        <div className={styles.stateError}>{loadError}</div>
      ) : !hasAny ? (
        <p className={styles.empty}>
          You have not been drawn onto any panels yet. Earn a verifier credential and you
          will be picked at random to review guides in your subjects.
        </p>
      ) : (
        <div className={styles.list}>
          {panels.map((p) => (
            <VerificationCard
              key={p.panelId}
              panel={p}
              authHeaders={authHeaders}
              onResolved={load}
            />
          ))}
          {disputes.length > 0 && panels.length > 0 && (
            <div className={styles.groupHeading}>
              <Gavel size={14} weight="fill" className={styles.headerIcon} />
              <span>Dispute panels</span>
            </div>
          )}
          {disputes.map((d) => (
            <DisputeCard
              key={d.disputeId}
              dispute={d}
              authHeaders={authHeaders}
              onResolved={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
