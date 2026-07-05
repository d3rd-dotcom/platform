import { sqlQuery, withTransaction, sqlQueryWithClient } from './db';
import type { PoolClient } from 'pg';

/**
 * Phase 5 — Disputes & Spin-offs data access.
 *
 * This module owns everything the dispute layer touches. It deliberately does
 * NOT edit lib/guides-db.ts, lib/guide-verification-db.ts, or lib/guide-votes-db.ts —
 * it only reads their tables and writes the new dispute tables from
 * db/migration-guide-disputes.sql (plus guides.status / guides.canonical_group_id).
 *
 * Panels mirror the verifier-jury draw in lib/guide-verification-db.ts: an
 * odd-numbered random draw with drop-one-on-even, mandatory written
 * justifications, and a conflict-of-interest exclusion.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** Dispute-panel size. Must stay ODD so a plurality winner always exists. */
export const DISPUTE_PANEL_SIZE = 3;

export const DISPUTE_TYPES = [
  'factual',
  'cross_niche',
  'verification_appeal',
  'rereview_appeal',
] as const;
export type DisputeType = (typeof DISPUTE_TYPES)[number];

export const DISPUTE_VERDICTS = ['uphold', 'overturn', 'fork', 'dismiss'] as const;
export type DisputeVerdict = (typeof DISPUTE_VERDICTS)[number];

export type DisputeStatus =
  | 'open'
  | 'panel_drawn'
  | 'resolved_upheld'
  | 'resolved_overturned'
  | 'resolved_forked'
  | 'dismissed';

/** Minimum evidence length — mirrors the DB CHECK constraint. */
export const MIN_EVIDENCE_LENGTH = 80;

/** Minimum written justification length — mirrors the DB CHECK constraint. */
export const MIN_JUSTIFICATION_LENGTH = 40;

/** Standing gate: minimum completed guides to open a dispute. */
export const MIN_COMPLETED_GUIDES = 3;

/** Spam guard: max dismissed disputes within the trailing window before lockout. */
export const MAX_DISMISSED_IN_WINDOW = 3;
export const DISMISSED_WINDOW_DAYS = 90;

// ── Types ────────────────────────────────────────────────────────────────────

export interface DisputeRecord {
  id: string;
  guideId: string;
  openerId: string;
  disputeType: DisputeType;
  evidence: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DisputeVoteRecord {
  id: string;
  disputeId: string;
  userId: string;
  verdict: DisputeVerdict;
  justification: string;
  createdAt: string;
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

/** Force an ODD count. If a draw lands on an even number, drop one. */
function toOdd(n: number): number {
  return n % 2 === 0 ? n - 1 : n;
}

interface DisputeRow {
  id: string;
  guide_id: string;
  opener_id: string;
  dispute_type: DisputeType;
  evidence: string;
  status: DisputeStatus;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

function mapDispute(row: DisputeRow): DisputeRecord {
  return {
    id: row.id,
    guideId: row.guide_id,
    openerId: row.opener_id,
    disputeType: row.dispute_type,
    evidence: row.evidence,
    status: row.status,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Standing gate ────────────────────────────────────────────────────────────

/**
 * A user may open a dispute only if they are in good standing:
 *   (a) they have completed >= MIN_COMPLETED_GUIDES guides (guide_progress),
 *       OR they hold ANY verifier credential (verifier_credentials); AND
 *   (b) they have NOT had MAX_DISMISSED_IN_WINDOW-or-more disputes dismissed in
 *       the trailing DISMISSED_WINDOW_DAYS days (spam guard).
 *
 * Runs as a single query so the gate is atomic. Returns nothing on success and
 * throws a 403 with a specific reason otherwise.
 */
async function assertOpenerStanding(
  client: PoolClient,
  openerId: string,
): Promise<void> {
  const rows = await sqlQueryWithClient<
    Array<{ completed_count: number; credential_count: number; dismissed_count: number }>
  >(
    client,
    `SELECT
       (SELECT COUNT(*) FROM guide_progress gp WHERE gp.user_id = :openerId)::int
         AS completed_count,
       (SELECT COUNT(*) FROM verifier_credentials vc WHERE vc.user_id = :openerId)::int
         AS credential_count,
       (SELECT COUNT(*) FROM guide_disputes d
         WHERE d.opener_id = :openerId
           AND d.status = 'dismissed'
           AND d.updated_at >= CURRENT_TIMESTAMP - (:windowDays || ' days')::interval)::int
         AS dismissed_count`,
    { openerId, windowDays: DISMISSED_WINDOW_DAYS },
  );
  const r = rows[0] ?? { completed_count: 0, credential_count: 0, dismissed_count: 0 };

  const meetsActivity =
    r.completed_count >= MIN_COMPLETED_GUIDES || r.credential_count > 0;
  if (!meetsActivity) {
    throw httpError(
      `You must complete at least ${MIN_COMPLETED_GUIDES} guides or hold a verifier credential to open a dispute.`,
      403,
    );
  }

  if (r.dismissed_count >= MAX_DISMISSED_IN_WINDOW) {
    throw httpError(
      `Too many recently dismissed disputes. Try again later.`,
      403,
    );
  }
}

// ── Open a dispute ───────────────────────────────────────────────────────────

/**
 * Open a dispute against a guide. Enforces the standing gate and the evidence
 * length rule, then immediately draws the moderator panel (status → panel_drawn).
 */
export async function openDispute(input: {
  guideId: string;
  openerId: string;
  disputeType: string;
  evidence: string;
}): Promise<{ dispute: DisputeRecord; memberIds: string[] }> {
  if (!DISPUTE_TYPES.includes(input.disputeType as DisputeType)) {
    throw httpError(
      `dispute_type must be one of: ${DISPUTE_TYPES.join(', ')}.`,
      400,
    );
  }
  const evidence = (input.evidence ?? '').trim();
  if (evidence.length < MIN_EVIDENCE_LENGTH) {
    throw httpError(
      `Evidence of at least ${MIN_EVIDENCE_LENGTH} characters is required to open a dispute.`,
      400,
    );
  }

  return withTransaction(async (client) => {
    // Guide must exist.
    const guideRows = await sqlQueryWithClient<Array<{ id: string; author_id: string | null }>>(
      client,
      `SELECT id, author_id FROM guides WHERE id = :guideId`,
      { guideId: input.guideId },
    );
    const guide = guideRows[0];
    if (!guide) throw httpError('Guide not found.', 404);

    // The author cannot dispute their own guide.
    if (guide.author_id && guide.author_id === input.openerId) {
      throw httpError('You cannot open a dispute against your own guide.', 403);
    }

    // Standing gate (atomic).
    await assertOpenerStanding(client, input.openerId);

    // Insert the dispute row.
    const disputeRows = await sqlQueryWithClient<Array<DisputeRow>>(
      client,
      `INSERT INTO guide_disputes (guide_id, opener_id, dispute_type, evidence, status)
       VALUES (:guideId, :openerId, :disputeType, :evidence, 'open')
       RETURNING id, guide_id, opener_id, dispute_type, evidence, status,
                 resolution_note, created_at, updated_at`,
      {
        guideId: input.guideId,
        openerId: input.openerId,
        disputeType: input.disputeType,
        evidence,
      },
    );
    const dispute = mapDispute(disputeRows[0]);

    // Draw the moderator panel in the same transaction.
    const memberIds = await drawDisputePanelInternal(client, dispute.id, input.guideId);

    return { dispute: { ...dispute, status: 'panel_drawn' }, memberIds };
  });
}

// ── Draw the dispute panel ───────────────────────────────────────────────────

/**
 * Conflict-of-interest exclusion query (shared): the eligible moderator pool is
 * every DISTINCT verifier_credentials holder EXCEPT
 *   (1) the guide's author, and
 *   (2) anyone who voted on the guide's verifier panel(s).
 * From that pool we draw an odd-numbered panel (target DISPUTE_PANEL_SIZE),
 * dropping one if the usable count is even.
 */
async function drawDisputePanelInternal(
  client: PoolClient,
  disputeId: string,
  guideId: string,
): Promise<string[]> {
  const poolRows = await sqlQueryWithClient<Array<{ user_id: string }>>(
    client,
    `SELECT DISTINCT vc.user_id
     FROM verifier_credentials vc
     WHERE vc.user_id <> ALL (
       -- (1) the guide's author
       SELECT g.author_id FROM guides g
       WHERE g.id = :guideId AND g.author_id IS NOT NULL
       UNION
       -- (2) anyone who voted on the guide's verifier panel(s)
       SELECT vpv.user_id
       FROM verifier_panel_votes vpv
       JOIN verifier_panels vp ON vp.id = vpv.panel_id
       WHERE vp.guide_id = :guideId
     )`,
    { guideId },
  );
  const pool = poolRows.map((r) => r.user_id);

  if (pool.length < 1) {
    throw httpError(
      'No eligible moderators are available to hear this dispute (conflict-of-interest exclusion left an empty pool).',
      409,
    );
  }

  // Draw up to DISPUTE_PANEL_SIZE, then force odd (drop one on even).
  const drawTarget = toOdd(Math.min(DISPUTE_PANEL_SIZE, pool.length));
  const drawn = shuffle(pool).slice(0, drawTarget);

  for (const memberId of drawn) {
    await sqlQueryWithClient(
      client,
      `INSERT INTO dispute_panel_members (dispute_id, user_id)
       VALUES (:disputeId, :userId)`,
      { disputeId, userId: memberId },
    );
  }

  await sqlQueryWithClient(
    client,
    `UPDATE guide_disputes SET status = 'panel_drawn' WHERE id = :disputeId AND status = 'open'`,
    { disputeId },
  );

  return drawn;
}

/**
 * Public entry point to (re)draw a dispute panel for an already-open dispute.
 * Idempotent-ish: if members already exist it returns them without redrawing.
 */
export async function drawDisputePanel(disputeId: string): Promise<string[]> {
  return withTransaction(async (client) => {
    const rows = await sqlQueryWithClient<
      Array<{ id: string; guide_id: string; status: DisputeStatus }>
    >(
      client,
      `SELECT id, guide_id, status FROM guide_disputes WHERE id = :disputeId FOR UPDATE`,
      { disputeId },
    );
    const dispute = rows[0];
    if (!dispute) throw httpError('Dispute not found.', 404);

    const existing = await sqlQueryWithClient<Array<{ user_id: string }>>(
      client,
      `SELECT user_id FROM dispute_panel_members WHERE dispute_id = :disputeId`,
      { disputeId },
    );
    if (existing.length > 0) return existing.map((r) => r.user_id);

    return drawDisputePanelInternal(client, disputeId, dispute.guide_id);
  });
}

// ── Cast a dispute vote (+ resolve on plurality) ─────────────────────────────

/**
 * A drawn moderator casts a justified verdict.
 *
 * Validates: dispute exists & is in 'panel_drawn'; caller is a drawn member;
 * hasn't voted yet; justification present and long enough.
 *
 * RESOLUTION: with an odd panel of N, the first verdict to reach
 * floor(N/2)+1 votes wins. On resolution:
 *   'uphold'   → status 'resolved_upheld'
 *   'overturn' → status 'resolved_overturned', guide status → 'unpublished'
 *   'fork'     → status 'resolved_forked', spin-off executed (see forkGuide)
 *   'dismiss'  → status 'dismissed'
 */
export async function castDisputeVote(input: {
  disputeId: string;
  userId: string;
  verdict: string;
  justification: string;
  /**
   * For a 'fork' verdict the panel may pin each side to a distinct niche subject.
   * originalSubject stays on the original guide, forkSubject is added to the fork.
   * Both optional — if omitted, the fork inherits the original's subjects verbatim.
   */
  originalSubject?: string | null;
  forkSubject?: string | null;
}): Promise<{
  vote: DisputeVoteRecord;
  status: DisputeStatus;
  resolved: boolean;
  forkGuideId: string | null;
}> {
  if (!DISPUTE_VERDICTS.includes(input.verdict as DisputeVerdict)) {
    throw httpError(`verdict must be one of: ${DISPUTE_VERDICTS.join(', ')}.`, 400);
  }
  const justification = (input.justification ?? '').trim();
  if (justification.length < MIN_JUSTIFICATION_LENGTH) {
    throw httpError(
      `A written justification of at least ${MIN_JUSTIFICATION_LENGTH} characters is required.`,
      400,
    );
  }
  const verdict = input.verdict as DisputeVerdict;

  return withTransaction(async (client) => {
    const disputeRows = await sqlQueryWithClient<
      Array<{ id: string; guide_id: string; status: DisputeStatus }>
    >(
      client,
      `SELECT id, guide_id, status FROM guide_disputes WHERE id = :disputeId FOR UPDATE`,
      { disputeId: input.disputeId },
    );
    const dispute = disputeRows[0];
    if (!dispute) throw httpError('Dispute not found.', 404);
    if (dispute.status !== 'panel_drawn') {
      if (dispute.status === 'open') {
        throw httpError('This dispute has no panel yet.', 409);
      }
      throw httpError('This dispute has already been resolved.', 409);
    }

    // Caller must be a drawn member.
    const memberRows = await sqlQueryWithClient<Array<{ user_id: string }>>(
      client,
      `SELECT user_id FROM dispute_panel_members
       WHERE dispute_id = :disputeId AND user_id = :userId`,
      { disputeId: input.disputeId, userId: input.userId },
    );
    if (memberRows.length === 0) {
      throw httpError('You are not a member of this dispute panel.', 403);
    }

    // One vote each.
    const existing = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM dispute_panel_votes
       WHERE dispute_id = :disputeId AND user_id = :userId`,
      { disputeId: input.disputeId, userId: input.userId },
    );
    if (existing.length > 0) {
      throw httpError('You have already voted on this dispute.', 409);
    }

    const voteRows = await sqlQueryWithClient<Array<DisputeVoteRow>>(
      client,
      `INSERT INTO dispute_panel_votes (dispute_id, user_id, verdict, justification)
       VALUES (:disputeId, :userId, :verdict, :justification)
       RETURNING id, dispute_id, user_id, verdict, justification, created_at`,
      { disputeId: input.disputeId, userId: input.userId, verdict, justification },
    );
    const vote = mapVote(voteRows[0]);

    // Tally + plurality/majority check.
    const panelSize = (
      await sqlQueryWithClient<Array<{ n: number }>>(
        client,
        `SELECT COUNT(*)::int AS n FROM dispute_panel_members WHERE dispute_id = :disputeId`,
        { disputeId: input.disputeId },
      )
    )[0].n;
    const threshold = Math.floor(panelSize / 2) + 1;

    const tallyRows = await sqlQueryWithClient<Array<{ verdict: DisputeVerdict; n: number }>>(
      client,
      `SELECT verdict, COUNT(*)::int AS n
       FROM dispute_panel_votes
       WHERE dispute_id = :disputeId
       GROUP BY verdict`,
      { disputeId: input.disputeId },
    );
    const counts: Record<DisputeVerdict, number> = {
      uphold: 0,
      overturn: 0,
      fork: 0,
      dismiss: 0,
    };
    for (const r of tallyRows) counts[r.verdict] = r.n;

    let winning: DisputeVerdict | null = null;
    for (const v of DISPUTE_VERDICTS) {
      if (counts[v] >= threshold) {
        winning = v;
        break;
      }
    }

    if (!winning) {
      return { vote, status: dispute.status, resolved: false, forkGuideId: null };
    }

    // Resolve.
    let newStatus: DisputeStatus;
    let forkGuideId: string | null = null;
    let resolutionNote: string;

    switch (winning) {
      case 'uphold':
        newStatus = 'resolved_upheld';
        resolutionNote = 'Panel upheld the dispute.';
        break;
      case 'overturn':
        newStatus = 'resolved_overturned';
        resolutionNote = 'Panel overturned the guide; it has been unpublished.';
        await sqlQueryWithClient(
          client,
          `UPDATE guides SET status = 'unpublished' WHERE id = :guideId`,
          { guideId: dispute.guide_id },
        );
        break;
      case 'fork':
        newStatus = 'resolved_forked';
        forkGuideId = await forkGuideInternal(client, dispute.guide_id, {
          originalSubject: input.originalSubject ?? null,
          forkSubject: input.forkSubject ?? null,
        });
        resolutionNote = 'Panel resolved to fork; a spin-off guide was created.';
        break;
      case 'dismiss':
      default:
        newStatus = 'dismissed';
        resolutionNote = 'Panel dismissed the dispute.';
        break;
    }

    await sqlQueryWithClient(
      client,
      `UPDATE guide_disputes
       SET status = :status, resolution_note = :note
       WHERE id = :disputeId`,
      { status: newStatus, note: resolutionNote, disputeId: input.disputeId },
    );

    return { vote, status: newStatus, resolved: true, forkGuideId };
  });
}

// ── Fork (spin-off) execution ────────────────────────────────────────────────

/**
 * Executes the spin-off for a 'fork' verdict. Runs inside the vote transaction.
 *
 * What the fork verdict DUPLICATES:
 *   1. The guide ROW — a new guides row with a unique slug '<slug>-fork'
 *      (deduped with a numeric suffix if taken) and topic_title
 *      '<topic_title> (fork)' (topic_title is UNIQUE), copying body, author_id,
 *      status; both original and fork end at status 'published'.
 *   2. canonical_group_id — a SHARED group id is stamped on BOTH the original and
 *      the fork (a fresh uuid is generated if the original had none), so the two
 *      forks are linked as a canonical group.
 *   3. guide_edges — every edge in BOTH directions is copied:
 *        - each prereq edge (X → original) becomes (X → fork)
 *        - each dependent edge (original → Y) becomes (fork → Y)
 *      Future edges must pick a fork explicitly; existing edges apply to both.
 *   4. guide_subjects — every subject tag on the original is copied to the fork,
 *      EXCEPT the resolution may assign each side a distinct niche subject:
 *      forkSubject is added to the fork; originalSubject (if given and not already
 *      present) is added to the original.
 * Methods and votes are NOT duplicated — a fork starts with a clean slate for
 * community votes, and methods can be re-authored on the niche fork.
 */
async function forkGuideInternal(
  client: PoolClient,
  originalId: string,
  niche: { originalSubject: string | null; forkSubject: string | null },
): Promise<string> {
  // Load the original.
  const rows = await sqlQueryWithClient<
    Array<{
      slug: string;
      topic_title: string;
      body: unknown;
      author_id: string | null;
      canonical_group_id: string | null;
    }>
  >(
    client,
    `SELECT slug, topic_title, body, author_id, canonical_group_id
     FROM guides WHERE id = :id FOR UPDATE`,
    { id: originalId },
  );
  const original = rows[0];
  if (!original) throw httpError('Original guide not found for fork.', 404);

  // Shared canonical_group_id: reuse the original's if present, else generate one.
  const groupRows = await sqlQueryWithClient<Array<{ gid: string }>>(
    client,
    `SELECT COALESCE(:existing::char(36), gen_random_uuid()::text) AS gid`,
    { existing: original.canonical_group_id },
  );
  const groupId = groupRows[0].gid;

  // Unique slug '<slug>-fork' (dedupe with a numeric suffix if taken).
  const forkSlug = await uniqueSlug(client, `${original.slug}-fork`);
  // Unique topic_title (topic_title is UNIQUE in guides).
  const forkTitle = await uniqueTopicTitle(client, `${original.topic_title} (fork)`);

  // 1. Duplicate the guide row → fork, published.
  const bodyJson =
    typeof original.body === 'string' ? original.body : JSON.stringify(original.body ?? []);
  const forkRows = await sqlQueryWithClient<Array<{ id: string }>>(
    client,
    `INSERT INTO guides (slug, topic_title, body, status, author_id, canonical_group_id)
     VALUES (:slug, :topicTitle, :body::jsonb, 'published', :authorId, :groupId)
     RETURNING id`,
    {
      slug: forkSlug,
      topicTitle: forkTitle,
      body: bodyJson,
      authorId: original.author_id,
      groupId,
    },
  );
  const forkId = forkRows[0].id;

  // 2. Stamp the shared canonical_group_id on the original + publish it.
  await sqlQueryWithClient(
    client,
    `UPDATE guides SET canonical_group_id = :groupId, status = 'published' WHERE id = :id`,
    { groupId, id: originalId },
  );

  // 3. Copy edges in BOTH directions to the fork.
  //    Prereqs: (X → original) → (X → fork). Guard against the cycle trigger by
  //    only copying edges whose prereq isn't the fork itself (can't happen yet).
  await sqlQueryWithClient(
    client,
    `INSERT INTO guide_edges (prereq_id, guide_id)
     SELECT e.prereq_id, :forkId
     FROM guide_edges e
     WHERE e.guide_id = :originalId AND e.prereq_id <> :forkId
     ON CONFLICT (prereq_id, guide_id) DO NOTHING`,
    { forkId, originalId },
  );
  //    Dependents: (original → Y) → (fork → Y).
  await sqlQueryWithClient(
    client,
    `INSERT INTO guide_edges (prereq_id, guide_id)
     SELECT :forkId, e.guide_id
     FROM guide_edges e
     WHERE e.prereq_id = :originalId AND e.guide_id <> :forkId
     ON CONFLICT (prereq_id, guide_id) DO NOTHING`,
    { forkId, originalId },
  );

  // 4. Copy subject tags to the fork, then apply the niche assignment.
  await sqlQueryWithClient(
    client,
    `INSERT INTO guide_subjects (guide_id, subject)
     SELECT :forkId, s.subject
     FROM guide_subjects s
     WHERE s.guide_id = :originalId
     ON CONFLICT (guide_id, subject) DO NOTHING`,
    { forkId, originalId },
  );
  if (niche.forkSubject && niche.forkSubject.trim()) {
    await sqlQueryWithClient(
      client,
      `INSERT INTO guide_subjects (guide_id, subject)
       VALUES (:forkId, :subject)
       ON CONFLICT (guide_id, subject) DO NOTHING`,
      { forkId, subject: niche.forkSubject.trim() },
    );
  }
  if (niche.originalSubject && niche.originalSubject.trim()) {
    await sqlQueryWithClient(
      client,
      `INSERT INTO guide_subjects (guide_id, subject)
       VALUES (:originalId, :subject)
       ON CONFLICT (guide_id, subject) DO NOTHING`,
      { originalId, subject: niche.originalSubject.trim() },
    );
  }

  return forkId;
}

async function uniqueSlug(client: PoolClient, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // Guides.slug is UNIQUE — probe until free.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taken = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM guides WHERE slug = :slug`,
      { slug: candidate },
    );
    if (taken.length === 0) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

async function uniqueTopicTitle(client: PoolClient, base: string): Promise<string> {
  let candidate = base;
  let n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const taken = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM guides WHERE topic_title = :title`,
      { title: candidate },
    );
    if (taken.length === 0) return candidate;
    n += 1;
    candidate = `${base} ${n}`;
  }
}

// ── Public reads ─────────────────────────────────────────────────────────────

/**
 * Public list of disputes for a guide, newest first, with opener username and
 * the current vote tally. Safe to render on the guide page.
 */
export async function getDisputes(guideId: string): Promise<
  Array<
    DisputeRecord & {
      openerUsername: string | null;
      voteCount: number;
    }
  >
> {
  const rows = await sqlQuery<
    Array<DisputeRow & { opener_username: string | null; vote_count: number }>
  >(
    `SELECT d.id, d.guide_id, d.opener_id, d.dispute_type, d.evidence, d.status,
            d.resolution_note, d.created_at, d.updated_at,
            u.username AS opener_username,
            (SELECT COUNT(*) FROM dispute_panel_votes v WHERE v.dispute_id = d.id)::int
              AS vote_count
     FROM guide_disputes d
     LEFT JOIN users u ON u.id = d.opener_id
     WHERE d.guide_id = :guideId
     ORDER BY d.created_at DESC`,
    { guideId },
  );
  return rows.map((r) => ({
    ...mapDispute(r),
    openerUsername: r.opener_username,
    voteCount: r.vote_count,
  }));
}

// ── Row mappers ──────────────────────────────────────────────────────────────

interface DisputeVoteRow {
  id: string;
  dispute_id: string;
  user_id: string;
  verdict: DisputeVerdict;
  justification: string;
  created_at: string;
}

function mapVote(row: DisputeVoteRow): DisputeVoteRecord {
  return {
    id: row.id,
    disputeId: row.dispute_id,
    userId: row.user_id,
    verdict: row.verdict,
    justification: row.justification,
    createdAt: row.created_at,
  };
}
