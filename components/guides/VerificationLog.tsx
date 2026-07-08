'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import {
  CheckCircle,
  XCircle,
  CircleNotch,
  Robot,
  Scales,
  CaretDown,
} from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './VerificationLog.module.css';

// Mirrors the shape returned by GET /api/guides/verification/[guideId].
interface CreScore {
  score: number;
  summary: string | null;
  donSignature: string | null;
  createdAt: string;
}

interface PanelVote {
  voterId: string;
  voterUsername: string | null;
  decision: 'approve' | 'reject';
  rubricItem: string;
  justification: string;
  createdAt: string;
}

interface Panel {
  id: string;
  status: 'open' | 'approved' | 'rejected';
  createdAt: string;
  creScore: CreScore | null;
  votes: PanelVote[];
}

interface VerificationLogData {
  guideId: string;
  guideStatus: string;
  /** One-time reward the author receives when the guide is verified. */
  authorReward: number;
  panels: Panel[];
}

interface Props {
  /** Guide id whose verification history is displayed. */
  guideId: string;
}

const RUBRIC_LABELS: Record<string, string> = {
  hierarchy_soundness: 'Hierarchy soundness',
  obvious_errors: 'Obvious errors',
  duplication: 'Duplication',
  scope: 'Scope',
};

const PANEL_STATUS_LABELS: Record<Panel['status'], string> = {
  open: 'In review',
  approved: 'Approved',
  rejected: 'Sent back',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Public verification audit log. Renders each verifier panel: the DON-signed
 * advisory CRE score (clearly labelled advisory, not a vote), and every
 * rubric-bound juror vote with its written justification and timestamp.
 *
 * This component is self-fetching and read-only. The reviewer wires it into the
 * guide page — it is NOT imported by app/courses/guides/[slug]/page.tsx here.
 */
export default function VerificationLog({ guideId }: Props) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { play } = useSound();
  const [data, setData] = useState<VerificationLogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pending, setPending] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guides/verification/${guideId}`, { cache: 'no-store' });
      if (!res.ok) {
        setError('Could not load the verification log.');
        return;
      }
      const json = await res.json();
      setData(json.log ?? null);
      setError(null);
    } catch {
      setError('Could not load the verification log.');
    } finally {
      setLoading(false);
    }
  }, [guideId]);

  useEffect(() => {
    load();
  }, [load]);

  // Whether the signed-in viewer is a pending panel member for this guide — powers
  // the "votes awaiting" pill that routes them to their queue on the profile page.
  useEffect(() => {
    if (!ready || !authenticated) {
      setPending(0);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await getAccessToken().catch(() => null);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch(`/api/guides/verification/${guideId}/pending`, {
          cache: 'no-store',
          headers,
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled) setPending(typeof json.pending === 'number' ? json.pending : 0);
      } catch {
        /* non-fatal — the pill just stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, guideId]);

  if (loading) {
    return (
      <div className={styles.state}>
        <CircleNotch size={18} className={styles.spinner} />
        <span>Loading verification log…</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.stateError}>{error}</div>;
  }

  if (!data || data.panels.length === 0) {
    return (
      <div className={styles.state}>
        This guide has not been through verifier review yet.
      </div>
    );
  }

  return (
    <section className={styles.wrapper} aria-label="Verification audit log">
      <header className={styles.header}>
        <Scales size={18} weight="fill" className={styles.headerIcon} />
        <h2 className={styles.title}>Verification audit log</h2>
        {pending > 0 && (
          <Link
            href="/profile"
            className={styles.pendingPill}
            onMouseEnter={() => play('soft-hover')}
            onClick={() => play('navigation')}
          >
            {pending} panel{pending === 1 ? '' : 's'} awaiting your vote
          </Link>
        )}
      </header>

      {data.guideStatus === 'published' && data.authorReward > 0 && (
        <p className={styles.authorReward}>
          Verified by the jury. The author earned {data.authorReward} credits for
          getting this guide published.
        </p>
      )}

      <div className={styles.panels}>
        {data.panels.map((panel, i) => (
          <article key={panel.id} className={styles.panel}>
            <header className={styles.panelHead}>
              <span className={styles.panelLabel}>
                Panel {data.panels.length > 1 ? data.panels.length - i : ''}
              </span>
              <span className={`${styles.statusPill} ${styles[`status_${panel.status}`]}`}>
                {PANEL_STATUS_LABELS[panel.status]}
              </span>
              <span className={styles.panelDate}>{formatDate(panel.createdAt)}</span>
            </header>

            {panel.creScore && (
              <div className={styles.creScore}>
                <div className={styles.creScoreHead}>
                  <Robot size={15} weight="fill" className={styles.creIcon} />
                  <span className={styles.creLabel}>CRE advisory score</span>
                  <span className={styles.creValue}>{panel.creScore.score}/100</span>
                  {panel.creScore.donSignature && (
                    <span className={styles.donBadge}>DON-signed</span>
                  )}
                </div>
                {panel.creScore.summary && (
                  <p className={styles.creSummary}>{panel.creScore.summary}</p>
                )}
                <p className={styles.creNote}>
                  Advisory input for the panel — not a vote.
                </p>
              </div>
            )}

            {panel.votes.length === 0 ? (
              <p className={styles.noVotes}>No votes cast yet.</p>
            ) : (
              <ul className={styles.votes}>
                {panel.votes.map((vote) => (
                  <li
                    key={`${panel.id}-${vote.voterId}`}
                    className={`${styles.vote} ${
                      vote.decision === 'approve' ? styles.voteApprove : styles.voteReject
                    }`}
                    onMouseEnter={() => play('soft-hover')}
                  >
                    <div className={styles.voteHead}>
                      {vote.decision === 'approve' ? (
                        <CheckCircle
                          size={16}
                          weight="fill"
                          className={styles.approveIcon}
                        />
                      ) : (
                        <XCircle
                          size={16}
                          weight="fill"
                          className={styles.rejectIcon}
                        />
                      )}
                      <span className={styles.voteDecision}>
                        {vote.decision === 'approve' ? 'Approve' : 'Reject'}
                      </span>
                      <span className={styles.rubricChip}>
                        {RUBRIC_LABELS[vote.rubricItem] ?? vote.rubricItem}
                      </span>
                      <span className={styles.voter}>
                        {vote.voterUsername ?? 'Verifier'}
                      </span>
                      <span className={styles.voteDate}>{formatDate(vote.createdAt)}</span>
                    </div>
                    <p className={styles.justification}>{vote.justification}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
