import { sqlQuery } from './db';

// ============================================================================
// Guide votes + auto-revision (BlueLearn integration — Phase 4)
// ----------------------------------------------------------------------------
// Reads/writes the guide_votes table created in db/migration-guides.sql. Does
// NOT touch lib/guides-db.ts (read-only for this phase). Upvote = one click;
// downvote MUST carry one of 8 rubric reasons (the DB enforces this via
// guide_votes_downvote_requires_reason — we surface a clean error).
// ============================================================================

// ── Rubric ───────────────────────────────────────────────────────────────────

export type VoteDirection = 'up' | 'down';

/** The 8 downvote rubric reasons — must match the DB CHECK constraint. */
export const RUBRIC_REASONS = [
  'unclear',
  'factually_wrong',
  'missing_step',
  'outdated',
  'broken_link',
  'prereq_gap',
  'wrong_level',
  'scope_creep',
] as const;

export type RubricReason = (typeof RUBRIC_REASONS)[number];

/** Human-facing labels for the rubric picker. */
export const RUBRIC_LABELS: Record<RubricReason, string> = {
  unclear: 'Unclear or confusing',
  factually_wrong: 'Factually wrong',
  missing_step: 'Missing a step',
  outdated: 'Out of date',
  broken_link: 'Broken link',
  prereq_gap: 'Prerequisite gap',
  wrong_level: 'Wrong difficulty level',
  scope_creep: 'Off-topic / scope creep',
};

/**
 * Rubric reasons that indicate a guide is materially broken (not just stylistic
 * friction) are weighted heavier in the auto-revision trigger.
 */
const HEAVY_REASONS: RubricReason[] = ['factually_wrong', 'missing_step', 'prereq_gap'];
const HEAVY_WEIGHT = 3;
const LIGHT_WEIGHT = 1;

export function isRubricReason(value: unknown): value is RubricReason {
  return typeof value === 'string' && (RUBRIC_REASONS as readonly string[]).includes(value);
}

// ── Trigger tunables ─────────────────────────────────────────────────────────

/** Minimum total votes in the window before ANY trigger can fire (brigade protection). */
const DEFAULT_VOTE_FLOOR = 20;
/** Downvote share above this fraction (of total window votes) unpublishes. */
const DOWNVOTE_SHARE_THRESHOLD = 0.6;
/** Weighted-rubric sum above this value unpublishes. */
const WEIGHTED_RUBRIC_THRESHOLD = 30;
/** A single section_pointer accumulating more than this many downvotes unpublishes. */
const SECTION_DOWNVOTE_THRESHOLD = 8;
/** Rolling window (days) over which votes count toward the trigger. */
const WINDOW_DAYS = 30;

function voteFloor(): number {
  const raw = process.env.GUIDE_REVISION_VOTE_FLOOR;
  if (!raw) return DEFAULT_VOTE_FLOOR;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_VOTE_FLOOR;
}

// ── Public / result types ─────────────────────────────────────────────────────

export interface VoteTotals {
  up: number;
  down: number;
}

export interface ModeratorBreakdown {
  totals: VoteTotals;
  /** Downvote counts keyed by rubric reason. */
  byReason: Record<RubricReason, number>;
  /** Downvote counts keyed by section_pointer (only downvotes that named a section). */
  bySection: Array<{ sectionPointer: string; downvotes: number }>;
}

export interface RevisionUnpublish {
  guideId: string;
  slug: string;
  topicTitle: string;
  authorId: string | null;
  /** Which rule(s) fired, e.g. ['downvote_share', 'section_density']. */
  reasons: string[];
  totalVotes: number;
  downVotes: number;
}

// ── castVote ───────────────────────────────────────────────────────────────────

/**
 * Upserts a single vote per (user, guide). Downvotes must carry a rubric reason
 * (the DB enforces it; we validate first and surface a clean 400). Upvotes must
 * NOT carry a reason/section — we null them out so re-voting up clears any prior
 * downvote metadata.
 *
 * @throws { status:number } on validation / not-found errors.
 */
export async function castVote(
  userId: string,
  guideId: string,
  direction: VoteDirection,
  rubricReason?: RubricReason | null,
  sectionPointer?: string | null,
): Promise<{ direction: VoteDirection; totals: VoteTotals }> {
  if (direction !== 'up' && direction !== 'down') {
    throw Object.assign(new Error('direction must be "up" or "down".'), { status: 400 });
  }

  let reason: RubricReason | null = null;
  let section: string | null = null;

  if (direction === 'down') {
    if (!isRubricReason(rubricReason)) {
      throw Object.assign(
        new Error('A downvote must cite one of the rubric reasons.'),
        { status: 400 },
      );
    }
    reason = rubricReason;
    section =
      typeof sectionPointer === 'string' && sectionPointer.trim()
        ? sectionPointer.trim().slice(0, 255)
        : null;
  }

  // Guide must exist (FK would error anyway, but this yields a clean 404).
  const guideRows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM guides WHERE id = :guideId`,
    { guideId },
  );
  if (!guideRows[0]) {
    throw Object.assign(new Error('Guide not found.'), { status: 404 });
  }

  try {
    await sqlQuery(
      `INSERT INTO guide_votes (user_id, guide_id, direction, rubric_reason, section_pointer)
       VALUES (:userId, :guideId, :direction, :reason, :section)
       ON CONFLICT (user_id, guide_id) DO UPDATE
         SET direction = EXCLUDED.direction,
             rubric_reason = EXCLUDED.rubric_reason,
             section_pointer = EXCLUDED.section_pointer,
             updated_at = CURRENT_TIMESTAMP`,
      { userId, guideId, direction, reason, section },
    );
  } catch (err: any) {
    // DB CHECK guide_votes_downvote_requires_reason — surface cleanly.
    if (err?.code === '23514') {
      throw Object.assign(
        new Error('A downvote must cite a rubric reason; an upvote must not.'),
        { status: 400 },
      );
    }
    throw err;
  }

  const totals = await getVoteTotals(guideId);
  return { direction, totals };
}

// ── getVoteTotals (public) ─────────────────────────────────────────────────────

/** Up / down counts only — the sole numbers exposed publicly. */
export async function getVoteTotals(guideId: string): Promise<VoteTotals> {
  const rows = await sqlQuery<Array<{ direction: string; n: string | number }>>(
    `SELECT direction, COUNT(*)::int AS n
     FROM guide_votes
     WHERE guide_id = :guideId
     GROUP BY direction`,
    { guideId },
  );
  const totals: VoteTotals = { up: 0, down: 0 };
  for (const r of rows) {
    if (r.direction === 'up') totals.up = Number(r.n);
    else if (r.direction === 'down') totals.down = Number(r.n);
  }
  return totals;
}

// ── getModeratorBreakdown (privileged) ─────────────────────────────────────────

/** Full rubric + per-section downvote breakdown. Never exposed publicly. */
export async function getModeratorBreakdown(guideId: string): Promise<ModeratorBreakdown> {
  const totals = await getVoteTotals(guideId);

  const byReason = Object.fromEntries(
    RUBRIC_REASONS.map((r) => [r, 0]),
  ) as Record<RubricReason, number>;

  const reasonRows = await sqlQuery<Array<{ rubric_reason: string; n: string | number }>>(
    `SELECT rubric_reason, COUNT(*)::int AS n
     FROM guide_votes
     WHERE guide_id = :guideId AND direction = 'down' AND rubric_reason IS NOT NULL
     GROUP BY rubric_reason`,
    { guideId },
  );
  for (const r of reasonRows) {
    if (isRubricReason(r.rubric_reason)) byReason[r.rubric_reason] = Number(r.n);
  }

  const sectionRows = await sqlQuery<Array<{ section_pointer: string; n: string | number }>>(
    `SELECT section_pointer, COUNT(*)::int AS n
     FROM guide_votes
     WHERE guide_id = :guideId AND direction = 'down' AND section_pointer IS NOT NULL
     GROUP BY section_pointer
     ORDER BY COUNT(*) DESC`,
    { guideId },
  );

  return {
    totals,
    byReason,
    bySection: sectionRows.map((r) => ({
      sectionPointer: r.section_pointer,
      downvotes: Number(r.n),
    })),
  };
}

// ── runRevisionCheck (the auto-revision trigger) ───────────────────────────────

/**
 * Scans every PUBLISHED guide and unpublishes any that crosses a revision
 * threshold within the last WINDOW_DAYS, provided it has at least the vote floor
 * of total window votes (brigade protection — low-volume guides can't trigger).
 *
 * A guide is unpublished when its window votes satisfy the floor AND ANY of:
 *   (a) downvote share  > 60%  of window votes                (downvote_share)
 *   (b) weighted rubric sum > 30 where factually_wrong /
 *       missing_step / prereq_gap count 3x, others 1x         (weighted_rubric)
 *   (c) any single section_pointer accrues > 8 window downvotes (section_density)
 *
 * On trigger: guides.status → 'unpublished'. Returns the unpublished guides with
 * the rule(s) that fired, so the caller can notify authors.
 */
export async function runRevisionCheck(): Promise<{
  scanned: number;
  unpublished: RevisionUnpublish[];
}> {
  const floor = voteFloor();

  // Per-guide window aggregates for published guides. One pass with FILTERed
  // aggregates; the heavy-weighted rubric sum is computed inline via CASE.
  const rows = await sqlQuery<
    Array<{
      id: string;
      slug: string;
      topic_title: string;
      author_id: string | null;
      total_votes: string | number;
      down_votes: string | number;
      weighted_rubric: string | number;
    }>
  >(
    `SELECT
       g.id,
       g.slug,
       g.topic_title,
       g.author_id,
       COUNT(v.id)::int AS total_votes,
       COUNT(v.id) FILTER (WHERE v.direction = 'down')::int AS down_votes,
       COALESCE(SUM(
         CASE
           WHEN v.direction = 'down' AND v.rubric_reason IN ('factually_wrong','missing_step','prereq_gap')
             THEN :heavy
           WHEN v.direction = 'down'
             THEN :light
           ELSE 0
         END
       ), 0)::int AS weighted_rubric
     FROM guides g
     JOIN guide_votes v
       ON v.guide_id = g.id
      AND v.created_at >= NOW() - (:windowDays || ' days')::interval
     WHERE g.status = 'published'
     GROUP BY g.id, g.slug, g.topic_title, g.author_id
     HAVING COUNT(v.id) >= :floor`,
    { heavy: HEAVY_WEIGHT, light: LIGHT_WEIGHT, windowDays: String(WINDOW_DAYS), floor },
  );

  // Section-density: guides with any single section_pointer over the threshold
  // within the window. Kept separate so its GROUP BY grain is per-section.
  const sectionRows = await sqlQuery<Array<{ guide_id: string; max_section_downvotes: string | number }>>(
    `SELECT guide_id, MAX(section_downvotes)::int AS max_section_downvotes
     FROM (
       SELECT v.guide_id, v.section_pointer, COUNT(*)::int AS section_downvotes
       FROM guide_votes v
       JOIN guides g ON g.id = v.guide_id AND g.status = 'published'
       WHERE v.direction = 'down'
         AND v.section_pointer IS NOT NULL
         AND v.created_at >= NOW() - (:windowDays || ' days')::interval
       GROUP BY v.guide_id, v.section_pointer
     ) s
     GROUP BY guide_id`,
    { windowDays: String(WINDOW_DAYS) },
  );
  const maxSectionByGuide = new Map<string, number>();
  for (const s of sectionRows) {
    maxSectionByGuide.set(s.guide_id, Number(s.max_section_downvotes));
  }

  const toUnpublish: RevisionUnpublish[] = [];

  for (const r of rows) {
    const total = Number(r.total_votes);
    const down = Number(r.down_votes);
    const weighted = Number(r.weighted_rubric);
    const maxSection = maxSectionByGuide.get(r.id) ?? 0;

    const reasons: string[] = [];
    if (total > 0 && down / total > DOWNVOTE_SHARE_THRESHOLD) reasons.push('downvote_share');
    if (weighted > WEIGHTED_RUBRIC_THRESHOLD) reasons.push('weighted_rubric');
    if (maxSection > SECTION_DOWNVOTE_THRESHOLD) reasons.push('section_density');

    if (reasons.length > 0) {
      toUnpublish.push({
        guideId: r.id,
        slug: r.slug,
        topicTitle: r.topic_title,
        authorId: r.author_id,
        reasons,
        totalVotes: total,
        downVotes: down,
      });
    }
  }

  // Flip status → 'unpublished' for the triggered guides (still published, to
  // avoid racing a concurrent manual change).
  if (toUnpublish.length > 0) {
    await sqlQuery(
      `UPDATE guides
       SET status = 'unpublished'
       WHERE id = ANY(:ids) AND status = 'published'`,
      { ids: toUnpublish.map((u) => u.guideId) },
    );
  }

  return { scanned: rows.length, unpublished: toUnpublish };
}
