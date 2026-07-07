import { sqlQuery, withTransaction, sqlQueryWithClient } from './db';

/**
 * Phase 3 — Verifier Jury data access.
 *
 * This module owns everything the verifier-jury layer touches. It deliberately
 * does NOT edit lib/guides-db.ts — it only reads/writes the `guides.status`
 * column directly and the new verification tables from
 * db/migration-guide-verification.sql.
 *
 * Panel model (see migration design note): panels are standalone; `proposal_id`
 * is nullable. Majority resolution is deterministic and computed from the votes.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Panel size. Must stay ODD so a simple majority always exists (no ties). */
export const PANEL_SIZE = 3;

export const RUBRIC_ITEMS = [
  'hierarchy_soundness',
  'obvious_errors',
  'duplication',
  'scope',
] as const;
export type RubricItem = (typeof RUBRIC_ITEMS)[number];

export type PanelDecision = 'approve' | 'reject';
export type PanelStatus = 'open' | 'approved' | 'rejected';

/** Minimum written justification length — mirrors the DB CHECK constraint. */
export const MIN_JUSTIFICATION_LENGTH = 40;

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerifierPanel {
  id: string;
  guideId: string;
  proposalId: string | null;
  status: PanelStatus;
  memberIds: string[];
  createdAt: string;
}

export interface PanelVoteRecord {
  id: string;
  panelId: string;
  userId: string;
  decision: PanelDecision;
  rubricItem: RubricItem;
  justification: string;
  createdAt: string;
}

export interface CreScoreRecord {
  score: number;
  summary: string | null;
  sources: unknown;
  donSignature: string | null;
  createdAt: string;
}

export interface VerificationLog {
  guideId: string;
  guideStatus: string;
  panels: Array<{
    id: string;
    status: PanelStatus;
    createdAt: string;
    creScore: CreScoreRecord | null;
    votes: Array<{
      voterId: string;
      voterUsername: string | null;
      decision: PanelDecision;
      rubricItem: RubricItem;
      justification: string;
      createdAt: string;
    }>;
  }>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/** Fisher–Yates shuffle (non-mutating). */
function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Force an ODD count. If a draw ever lands on an even number, drop one — the
 * odd-number mandate (a jury must never tie). `n` here is already <= pool size.
 */
function toOdd(n: number): number {
  return n % 2 === 0 ? n - 1 : n;
}

// ── Submit for verification (draw a panel) ───────────────────────────────────

/**
 * Author submits a draft guide for verification.
 *
 * 1. Guide must exist and be a `draft`.
 * 2. Flip guide status → `pending_verification`.
 * 3. Draw an ODD-numbered panel (target PANEL_SIZE = 3) at random from
 *    verifier_credentials holders whose subject matches ANY of the guide's
 *    subjects. The author is excluded (can't verify their own work).
 * 4. If the eligible pool yields an even usable count, drop one (odd mandate).
 *
 * Returns the created panel. Everything runs in one transaction so a partially
 * drawn panel can never be left behind.
 */
export async function submitGuideForVerification(guideId: string): Promise<VerifierPanel> {
  return withTransaction(async (client) => {
    // Load guide + author + subjects.
    const guideRows = await sqlQueryWithClient<
      Array<{ id: string; status: string; author_id: string | null }>
    >(
      client,
      `SELECT id, status, author_id FROM guides WHERE id = :guideId FOR UPDATE`,
      { guideId },
    );
    const guide = guideRows[0];
    if (!guide) throw httpError('Guide not found.', 404);
    if (guide.status !== 'draft') {
      throw httpError(
        `Only draft guides can be submitted for verification (current status: ${guide.status}).`,
        409,
      );
    }

    const subjectRows = await sqlQueryWithClient<Array<{ subject: string }>>(
      client,
      `SELECT subject FROM guide_subjects WHERE guide_id = :guideId`,
      { guideId },
    );
    const subjects = subjectRows.map((r) => r.subject);
    if (subjects.length === 0) {
      throw httpError('Guide must have at least one subject tag before verification.', 409);
    }

    // Eligible pool: distinct credential holders for any matching subject,
    // excluding the author. DISTINCT because a user may hold credentials in
    // several of the guide's subjects.
    const poolRows = await sqlQueryWithClient<Array<{ user_id: string }>>(
      client,
      `SELECT DISTINCT vc.user_id
       FROM verifier_credentials vc
       WHERE vc.subject = ANY(:subjects)
         AND (:authorId::char(36) IS NULL OR vc.user_id <> :authorId)`,
      { subjects, authorId: guide.author_id },
    );
    const pool = poolRows.map((r) => r.user_id);

    if (pool.length < 1) {
      // Thrown before any INSERT/UPDATE in this transaction, so withTransaction's
      // ROLLBACK is a no-op here — the guide stays exactly as it was (still
      // 'draft', no panel, no partial rows). Fail-closed by construction, not by
      // cleanup: nothing gets left stranded in pending_verification.
      throw httpError(
        'No verifiers are credentialed for this subject yet. Your draft is safe — try again once verifiers exist.',
        409,
      );
    }

    // Draw: take up to PANEL_SIZE, then force odd. With PANEL_SIZE=3 the possible
    // panel sizes are 3 (pool>=3) or 1 (pool==1 or ==2, since toOdd(2)=1).
    const drawTarget = toOdd(Math.min(PANEL_SIZE, pool.length));
    const drawn = shuffle(pool).slice(0, drawTarget);

    // Create the panel + member rows.
    const panelRows = await sqlQueryWithClient<Array<{ id: string; created_at: string }>>(
      client,
      `INSERT INTO verifier_panels (guide_id, status)
       VALUES (:guideId, 'open')
       RETURNING id, created_at`,
      { guideId },
    );
    const panelId = panelRows[0].id;

    for (const memberId of drawn) {
      await sqlQueryWithClient(
        client,
        `INSERT INTO verifier_panel_members (panel_id, user_id)
         VALUES (:panelId, :userId)`,
        { panelId, userId: memberId },
      );
    }

    // Flip guide status.
    await sqlQueryWithClient(
      client,
      `UPDATE guides SET status = 'pending_verification' WHERE id = :guideId`,
      { guideId },
    );

    return {
      id: panelId,
      guideId,
      proposalId: null,
      status: 'open' as PanelStatus,
      memberIds: drawn,
      createdAt: panelRows[0].created_at,
    };
  });
}

// ── Cast a panel vote (+ resolve on majority) ────────────────────────────────

/**
 * A drawn panel member casts a rubric-bound, justified vote.
 *
 * Validates: panel exists & open; caller is a drawn member; hasn't voted yet;
 * rubric_item valid; justification present and long enough (business rule —
 * mirrors the DB CHECK, but we validate in-app to return a clean 400 and to make
 * the "missing justification = invalid vote" rule explicit).
 *
 * MAJORITY RESOLUTION (deterministic):
 *   Panel of odd size N needs floor(N/2)+1 votes for the SAME decision to
 *   resolve. As soon as either 'approve' or 'reject' reaches that threshold, the
 *   panel closes:
 *     - majority approve → panel 'approved', guide status → 'published'
 *     - majority reject  → panel 'rejected', guide status → 'draft' (back to
 *       the author to revise and resubmit)
 *   Because N is odd, a split can never tie; the first side to reach the
 *   threshold wins even before every juror has voted.
 */
export async function castPanelVote(input: {
  panelId: string;
  userId: string;
  decision: PanelDecision;
  rubricItem: string;
  justification: string;
}): Promise<{
  vote: PanelVoteRecord;
  panelStatus: PanelStatus;
  guideStatus: string | null;
  resolved: boolean;
}> {
  const decision = input.decision;
  if (decision !== 'approve' && decision !== 'reject') {
    throw httpError('decision must be "approve" or "reject".', 400);
  }
  if (!RUBRIC_ITEMS.includes(input.rubricItem as RubricItem)) {
    throw httpError(
      `rubric_item must be one of: ${RUBRIC_ITEMS.join(', ')}.`,
      400,
    );
  }
  const justification = (input.justification ?? '').trim();
  if (justification.length < MIN_JUSTIFICATION_LENGTH) {
    // Missing / too-short justification = invalid vote (business rule).
    throw httpError(
      `A written justification of at least ${MIN_JUSTIFICATION_LENGTH} characters is required.`,
      400,
    );
  }

  return withTransaction(async (client) => {
    const panelRows = await sqlQueryWithClient<
      Array<{ id: string; guide_id: string; status: PanelStatus }>
    >(
      client,
      `SELECT id, guide_id, status FROM verifier_panels WHERE id = :panelId FOR UPDATE`,
      { panelId: input.panelId },
    );
    const panel = panelRows[0];
    if (!panel) throw httpError('Panel not found.', 404);
    if (panel.status !== 'open') {
      throw httpError('This panel has already been resolved.', 409);
    }

    // Caller must be a drawn member.
    const memberRows = await sqlQueryWithClient<Array<{ user_id: string }>>(
      client,
      `SELECT user_id FROM verifier_panel_members
       WHERE panel_id = :panelId AND user_id = :userId`,
      { panelId: input.panelId, userId: input.userId },
    );
    if (memberRows.length === 0) {
      throw httpError('You are not a member of this verification panel.', 403);
    }

    // One vote each.
    const existing = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM verifier_panel_votes
       WHERE panel_id = :panelId AND user_id = :userId`,
      { panelId: input.panelId, userId: input.userId },
    );
    if (existing.length > 0) {
      throw httpError('You have already voted on this panel.', 409);
    }

    const voteRows = await sqlQueryWithClient<Array<PanelVoteRow>>(
      client,
      `INSERT INTO verifier_panel_votes (panel_id, user_id, decision, rubric_item, justification)
       VALUES (:panelId, :userId, :decision, :rubricItem, :justification)
       RETURNING id, panel_id, user_id, decision, rubric_item, justification, created_at`,
      {
        panelId: input.panelId,
        userId: input.userId,
        decision,
        rubricItem: input.rubricItem,
        justification,
      },
    );
    const vote = mapVote(voteRows[0]);

    // Tally + majority check.
    const panelSize = (
      await sqlQueryWithClient<Array<{ n: number }>>(
        client,
        `SELECT COUNT(*)::int AS n FROM verifier_panel_members WHERE panel_id = :panelId`,
        { panelId: input.panelId },
      )
    )[0].n;
    const threshold = Math.floor(panelSize / 2) + 1;

    const tallyRows = await sqlQueryWithClient<Array<{ decision: PanelDecision; n: number }>>(
      client,
      `SELECT decision, COUNT(*)::int AS n
       FROM verifier_panel_votes
       WHERE panel_id = :panelId
       GROUP BY decision`,
      { panelId: input.panelId },
    );
    let approves = 0;
    let rejects = 0;
    for (const r of tallyRows) {
      if (r.decision === 'approve') approves = r.n;
      else if (r.decision === 'reject') rejects = r.n;
    }

    let panelStatus: PanelStatus = 'open';
    let guideStatus: string | null = null;
    let resolved = false;

    if (approves >= threshold) {
      panelStatus = 'approved';
      guideStatus = 'published';
      resolved = true;
    } else if (rejects >= threshold) {
      panelStatus = 'rejected';
      guideStatus = 'draft';
      resolved = true;
    }

    if (resolved) {
      await sqlQueryWithClient(
        client,
        `UPDATE verifier_panels SET status = :status WHERE id = :panelId`,
        { status: panelStatus, panelId: input.panelId },
      );
      await sqlQueryWithClient(
        client,
        `UPDATE guides SET status = :status WHERE id = :guideId`,
        { status: guideStatus, guideId: panel.guide_id },
      );
    }

    return { vote, panelStatus, guideStatus, resolved };
  });
}

// ── CRE advisory score (written by the DON callback route) ───────────────────

/**
 * Upsert the DON-signed ADVISORY CRE score for a panel. Called only from the
 * authenticated cre-score callback route. This is INPUT displayed to the panel,
 * never a vote — it does not touch panel or guide status.
 */
export async function recordCreScore(input: {
  panelId: string;
  score: number;
  summary?: string | null;
  sources?: unknown;
  donSignature?: string | null;
}): Promise<void> {
  const score = Math.round(Number(input.score));
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    throw httpError('score must be an integer between 0 and 100.', 400);
  }

  const panelRows = await sqlQuery<Array<{ id: string; guide_id: string }>>(
    `SELECT id, guide_id FROM verifier_panels WHERE id = :panelId`,
    { panelId: input.panelId },
  );
  const panel = panelRows[0];
  if (!panel) throw httpError('Panel not found.', 404);

  await sqlQuery(
    `INSERT INTO guide_cre_scores (panel_id, guide_id, score, summary, sources, don_signature)
     VALUES (:panelId, :guideId, :score, :summary, :sources::jsonb, :donSignature)
     ON CONFLICT (panel_id) DO UPDATE SET
       score = EXCLUDED.score,
       summary = EXCLUDED.summary,
       sources = EXCLUDED.sources,
       don_signature = EXCLUDED.don_signature,
       created_at = CURRENT_TIMESTAMP`,
    {
      panelId: input.panelId,
      guideId: panel.guide_id,
      score,
      summary: input.summary ?? null,
      sources: input.sources != null ? JSON.stringify(input.sources) : null,
      donSignature: input.donSignature ?? null,
    },
  );
}

/** Latest open panel for a guide (used by the CRE workflow to attach its score). */
export async function getOpenPanelForGuide(guideId: string): Promise<string | null> {
  const rows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM verifier_panels
     WHERE guide_id = :guideId AND status = 'open'
     ORDER BY created_at DESC
     LIMIT 1`,
    { guideId },
  );
  return rows[0]?.id ?? null;
}

// ── Public audit log ─────────────────────────────────────────────────────────

/**
 * Public verification audit log for a guide: every panel, its CRE advisory
 * score, and every rubric-bound vote with its justification and timestamp.
 */
export async function getVerificationLog(guideId: string): Promise<VerificationLog | null> {
  const guideRows = await sqlQuery<Array<{ id: string; status: string }>>(
    `SELECT id, status FROM guides WHERE id = :guideId`,
    { guideId },
  );
  if (!guideRows[0]) return null;

  const panelRows = await sqlQuery<
    Array<{ id: string; status: PanelStatus; created_at: string }>
  >(
    `SELECT id, status, created_at FROM verifier_panels
     WHERE guide_id = :guideId
     ORDER BY created_at ASC`,
    { guideId },
  );
  const panelIds = panelRows.map((p) => p.id);

  const voteRows = panelIds.length
    ? await sqlQuery<
        Array<{
          panel_id: string;
          user_id: string;
          username: string | null;
          decision: PanelDecision;
          rubric_item: RubricItem;
          justification: string;
          created_at: string;
        }>
      >(
        `SELECT v.panel_id, v.user_id, u.username, v.decision, v.rubric_item,
                v.justification, v.created_at
         FROM verifier_panel_votes v
         LEFT JOIN users u ON u.id = v.user_id
         WHERE v.panel_id = ANY(:ids)
         ORDER BY v.created_at ASC`,
        { ids: panelIds },
      )
    : [];

  const creRows = panelIds.length
    ? await sqlQuery<
        Array<{
          panel_id: string;
          score: number;
          summary: string | null;
          sources: unknown;
          don_signature: string | null;
          created_at: string;
        }>
      >(
        `SELECT panel_id, score, summary, sources, don_signature, created_at
         FROM guide_cre_scores
         WHERE panel_id = ANY(:ids)`,
        { ids: panelIds },
      )
    : [];
  const creByPanel = new Map<string, CreScoreRecord>();
  for (const c of creRows) {
    creByPanel.set(c.panel_id, {
      score: c.score,
      summary: c.summary,
      sources: c.sources,
      donSignature: c.don_signature,
      createdAt: c.created_at,
    });
  }

  const votesByPanel = new Map<string, VerificationLog['panels'][number]['votes']>();
  for (const v of voteRows) {
    const list = votesByPanel.get(v.panel_id) ?? [];
    list.push({
      voterId: v.user_id,
      voterUsername: v.username,
      decision: v.decision,
      rubricItem: v.rubric_item,
      justification: v.justification,
      createdAt: v.created_at,
    });
    votesByPanel.set(v.panel_id, list);
  }

  return {
    guideId: guideRows[0].id,
    guideStatus: guideRows[0].status,
    panels: panelRows.map((p) => ({
      id: p.id,
      status: p.status,
      createdAt: p.created_at,
      creScore: creByPanel.get(p.id) ?? null,
      votes: votesByPanel.get(p.id) ?? [],
    })),
  };
}

// ── Member assignment queue ──────────────────────────────────────────────────

export interface MemberPanelAssignment {
  panelId: string;
  guideId: string;
  guideSlug: string;
  guideTitle: string;
  status: PanelStatus;
  createdAt: string;
  /** Whether the current member has already cast their vote on this panel. */
  hasVoted: boolean;
  /** The member's own decision, present only when hasVoted. */
  myDecision: PanelDecision | null;
  /** The member's own rubric item, present only when hasVoted. */
  myRubricItem: RubricItem | null;
  /** Vote counts so far (all decisions), for a light progress hint. */
  voteCount: number;
  /** DON-signed advisory CRE score, if one has been recorded for this panel. */
  creScore: number | null;
}

/**
 * Verification panels this user was drawn onto — their personal assignment queue.
 *
 * Returns, per panel: the guide (slug + title for linking), the panel status, and
 * whether the caller has already voted (with their own decision/rubric so the UI
 * can render a voted state). Open panels the caller has NOT voted on come first
 * (actionable), then the rest, newest first within each group. Recently resolved
 * panels are included so the member sees the outcome of juries they served on.
 */
export async function getPanelsForMember(userId: string): Promise<MemberPanelAssignment[]> {
  const rows = await sqlQuery<
    Array<{
      panel_id: string;
      guide_id: string;
      guide_slug: string;
      guide_title: string;
      status: PanelStatus;
      created_at: string;
      my_vote_decision: PanelDecision | null;
      my_vote_rubric: RubricItem | null;
      vote_count: number;
      cre_score: number | null;
    }>
  >(
    `SELECT p.id AS panel_id,
            p.guide_id,
            g.slug AS guide_slug,
            g.topic_title AS guide_title,
            p.status,
            p.created_at,
            mv.decision AS my_vote_decision,
            mv.rubric_item AS my_vote_rubric,
            (SELECT COUNT(*) FROM verifier_panel_votes v WHERE v.panel_id = p.id)::int
              AS vote_count,
            cs.score AS cre_score
     FROM verifier_panel_members m
     JOIN verifier_panels p ON p.id = m.panel_id
     JOIN guides g ON g.id = p.guide_id
     LEFT JOIN verifier_panel_votes mv
       ON mv.panel_id = p.id AND mv.user_id = m.user_id
     LEFT JOIN guide_cre_scores cs ON cs.panel_id = p.id
     WHERE m.user_id = :userId
     ORDER BY
       (p.status = 'open' AND mv.id IS NULL) DESC,
       p.created_at DESC`,
    { userId },
  );

  return rows.map((r) => ({
    panelId: r.panel_id,
    guideId: r.guide_id,
    guideSlug: r.guide_slug,
    guideTitle: r.guide_title,
    status: r.status,
    createdAt: r.created_at,
    hasVoted: r.my_vote_decision != null,
    myDecision: r.my_vote_decision,
    myRubricItem: r.my_vote_rubric,
    voteCount: r.vote_count,
    creScore: r.cre_score,
  }));
}

/**
 * How many OPEN verification panels this user was drawn onto for a given guide
 * and has NOT yet voted on. Powers the "you have votes awaiting" pill on the
 * guide page's verification log. Returns 0 for a null/anonymous user.
 */
export async function countPendingPanelVotesForGuide(
  guideId: string,
  userId: string | null,
): Promise<number> {
  if (!userId) return 0;
  const rows = await sqlQuery<Array<{ n: number }>>(
    `SELECT COUNT(*)::int AS n
     FROM verifier_panel_members m
     JOIN verifier_panels p ON p.id = m.panel_id
     LEFT JOIN verifier_panel_votes v
       ON v.panel_id = p.id AND v.user_id = m.user_id
     WHERE m.user_id = :userId
       AND p.guide_id = :guideId
       AND p.status = 'open'
       AND v.id IS NULL`,
    { guideId, userId },
  );
  return rows[0]?.n ?? 0;
}

// ── Row mappers ──────────────────────────────────────────────────────────────

interface PanelVoteRow {
  id: string;
  panel_id: string;
  user_id: string;
  decision: PanelDecision;
  rubric_item: RubricItem;
  justification: string;
  created_at: string;
}

function mapVote(row: PanelVoteRow): PanelVoteRecord {
  return {
    id: row.id,
    panelId: row.panel_id,
    userId: row.user_id,
    decision: row.decision,
    rubricItem: row.rubric_item,
    justification: row.justification,
    createdAt: row.created_at,
  };
}
