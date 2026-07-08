import { withTransaction } from './db';
import type { PoolClient } from 'pg';

// ── Reward tiers ─────────────────────────────────────────────────────────────
// Base per-guide reward matches the VIP flow's COMPLETION_REWARD
// (app/api/vip/courses/[id]/diamonds/route.ts), so a guide completion pays the
// same as a VIP course task.
export const GUIDE_COMPLETE_REWARD = 50;

// Bonus tiers, expressed as multiples of the base reward.
const LEVEL_CLEAR_MULTIPLIER = 3;
const WALKTHROUGH_COMPLETE_MULTIPLIER = 10;

// Legacy of the retired loot box: the walkthrough payout includes the diamond
// value of one free spin. The amount stays so existing claims and payouts keep
// their meaning.
const SPIN_COST = 10;

export const LEVEL_CLEAR_REWARD = GUIDE_COMPLETE_REWARD * LEVEL_CLEAR_MULTIPLIER;
export const WALKTHROUGH_COMPLETE_REWARD = GUIDE_COMPLETE_REWARD * WALKTHROUGH_COMPLETE_MULTIPLIER;

// One-time reward paid to a guide's AUTHOR when a verifier panel approves it and
// it flips to published. Authoring a verified guide should outweigh completing
// one (GUIDE_COMPLETE_REWARD = 50) or clearing a level (LEVEL_CLEAR_REWARD = 150),
// but stay below clearing a whole walkthrough (WALKTHROUGH_COMPLETE_REWARD = 500).
// Single source of truth — never hardcode this number elsewhere.
export const GUIDE_VERIFIED_AUTHOR_REWARD = 250;

export interface GuideRewardResult {
  diamonds: number;
  levelCleared: boolean;
  walkthroughComplete: boolean;
  spinGranted: boolean;
}

interface ClosureNode {
  id: string;
  level: number;
}

/**
 * Awards diamond payouts for completing `guideId`, treating that guide as the
 * target of its own walkthrough closure (the transitive prerequisite set, with
 * computed longest-path levels — the same closure lib/guides-db.getWalkthrough
 * computes).
 *
 * Three idempotent tiers, each guarded by a UNIQUE (user_id, guide_id, claim_type)
 * row in guide_diamond_claims (ON CONFLICT DO NOTHING, mirroring the VIP claim
 * pattern):
 *   - guide_complete: always attempted for this guide.
 *   - level_clear (3x): when this completion means the user has now completed
 *     every guide sharing this guide's level within the closure.
 *   - walkthrough_complete (10x + spin-equivalent diamonds): when the user has
 *     now completed every guide in the closure.
 *
 * Diamonds are credited to users.shard_count, the same balance the VIP claim flow
 * credits. Must be called AFTER guide_progress has recorded the completion, so
 * that the closure's completion counts already include this guide.
 *
 * Fail-closed guards (money path — no payout, though completion itself stands):
 *   - the target guide must exist and be PUBLISHED (completeGuide enforces this
 *     too; re-checked here so the payout path never trusts its caller);
 *   - the completing user must not be the guide's author — authors may complete
 *     their own guide to progress through walkthroughs, but earn nothing for it.
 */
export async function awardGuideRewards(
  userId: string,
  guideId: string,
): Promise<GuideRewardResult> {
  return withTransaction(async (client) => {
    const guideRes = await client.query<{ author_id: string | null; status: string }>(
      `SELECT author_id, status FROM guides WHERE id = $1`,
      [guideId],
    );
    const guide = guideRes.rows[0];
    if (!guide || guide.status !== 'published' || guide.author_id === userId) {
      return { diamonds: 0, levelCleared: false, walkthroughComplete: false, spinGranted: false };
    }

    // Compute the walkthrough closure of guideId with per-node levels. This is
    // the same recursive-CTE strategy as getWalkthrough, restricted to what the
    // reward tiers need (id + level). Like getWalkthrough, only PUBLISHED
    // prereqs are traversed — non-published guides can't be completed, so
    // counting them here would strand the level_clear / walkthrough_complete
    // bonuses forever.
    const closureRes = await client.query<ClosureNode>(
      `
      WITH RECURSIVE closure AS (
        SELECT $1::char(36) AS id
        UNION
        SELECT e.prereq_id
        FROM guide_edges e
        JOIN closure c ON e.guide_id = c.id
        JOIN guides p ON p.id = e.prereq_id AND p.status = 'published'
      ),
      sub_edges AS (
        SELECT e.prereq_id, e.guide_id
        FROM guide_edges e
        JOIN closure a ON a.id = e.prereq_id
        JOIN closure b ON b.id = e.guide_id
      ),
      lvl AS (
        SELECT c.id, 0 AS level
        FROM closure c
        WHERE NOT EXISTS (
          SELECT 1 FROM sub_edges se WHERE se.guide_id = c.id
        )
        UNION ALL
        SELECT se.guide_id, l.level + 1
        FROM lvl l
        JOIN sub_edges se ON se.prereq_id = l.id
      )
      SELECT lvl.id AS id, MAX(lvl.level) AS level
      FROM lvl
      GROUP BY lvl.id
      `,
      [guideId],
    );

    const closure = closureRes.rows.map((r) => ({ id: r.id, level: Number(r.level) || 0 }));
    const closureIds = closure.map((n) => n.id);

    // Which closure guides has this user completed? (guide_progress already
    // includes the just-completed guide by the time this runs.)
    const doneRes = closureIds.length
      ? await client.query<{ guide_id: string }>(
          `SELECT guide_id FROM guide_progress
           WHERE user_id = $1 AND guide_id = ANY($2::char(36)[])`,
          [userId, closureIds],
        )
      : { rows: [] as Array<{ guide_id: string }> };
    const completed = new Set(doneRes.rows.map((r) => r.guide_id));

    // The level of the guide we just completed, within this closure.
    const thisNode = closure.find((n) => n.id === guideId);
    const thisLevel = thisNode?.level ?? 0;

    // level_clear: every guide at this guide's level in the closure is complete.
    const levelPeers = closure.filter((n) => n.level === thisLevel);
    const levelCleared = levelPeers.length > 0 && levelPeers.every((n) => completed.has(n.id));

    // walkthrough_complete: every guide in the closure is complete.
    const walkthroughComplete =
      closure.length > 0 && closure.every((n) => completed.has(n.id));

    let diamonds = 0;
    let awardedLevelClear = false;
    let awardedWalkthrough = false;

    // Helper: insert a claim row idempotently; credit only when a row is inserted.
    const claim = async (claimType: string, amount: number): Promise<boolean> => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO guide_diamond_claims (user_id, guide_id, claim_type, diamonds)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, guide_id, claim_type) DO NOTHING
         RETURNING id`,
        [userId, guideId, claimType, amount],
      );
      return res.rows.length > 0;
    };

    if (await claim('guide_complete', GUIDE_COMPLETE_REWARD)) {
      diamonds += GUIDE_COMPLETE_REWARD;
    }

    if (levelCleared && (await claim('level_clear', LEVEL_CLEAR_REWARD))) {
      diamonds += LEVEL_CLEAR_REWARD;
      awardedLevelClear = true;
    }

    if (walkthroughComplete) {
      // The 10x bonus and the free-spin-equivalent diamonds are recorded together
      // under one claim so the whole walkthrough payout is credited exactly once.
      const walkthroughPayout = WALKTHROUGH_COMPLETE_REWARD + SPIN_COST;
      if (await claim('walkthrough_complete', walkthroughPayout)) {
        diamonds += walkthroughPayout;
        awardedWalkthrough = true;
      }
    }

    if (diamonds > 0) {
      await creditShards(client, userId, diamonds);
    }

    return {
      diamonds,
      levelCleared: awardedLevelClear,
      walkthroughComplete: awardedWalkthrough,
      // A spin is "granted" as its diamond-equivalent whenever the walkthrough
      // payout was newly credited (see SPIN_COST note above).
      spinGranted: awardedWalkthrough,
    };
  });
}

async function creditShards(client: PoolClient, userId: string, amount: number): Promise<void> {
  await client.query(
    `UPDATE users SET shard_count = shard_count + $1 WHERE id = $2`,
    [amount, userId],
  );
}

export interface AuthorRewardResult {
  awarded: boolean;
  diamonds: number;
  authorId: string | null;
}

/**
 * Pays a guide's author the one-time GUIDE_VERIFIED_AUTHOR_REWARD when the guide
 * is approved by a verifier panel and published.
 *
 * MUST run inside the same transaction that flips the guide to 'published' (see
 * lib/guide-verification-db.ts castPanelVote) so publishing and paying are atomic:
 * if the credit fails, the whole verification transaction rolls back rather than
 * publishing without accounting.
 *
 * Money-path guards, mirroring awardGuideRewards + the guide_diamond_claims
 * pattern:
 *   - Fail-closed on a missing author: author_id NULL means no payout, silently
 *     (the guide still publishes — authorship reward is separate from the verdict).
 *   - Idempotent, one payout per guide EVER: the credit is gated by a
 *     guide_author_claims row with UNIQUE (guide_id) and ON CONFLICT DO NOTHING,
 *     so a reject-and-resubmit-and-reapprove cycle, or any re-verification, never
 *     pays twice.
 *   - users.shard_count is credited only when a claim row was actually inserted,
 *     never outside this transaction.
 */
export async function awardAuthorVerificationReward(
  client: PoolClient,
  guideId: string,
): Promise<AuthorRewardResult> {
  const guideRes = await client.query<{ author_id: string | null }>(
    `SELECT author_id FROM guides WHERE id = $1`,
    [guideId],
  );
  const authorId = guideRes.rows[0]?.author_id ?? null;

  // Fail-closed: no author, no payout — silently.
  if (!authorId) {
    return { awarded: false, diamonds: 0, authorId: null };
  }

  // One claim per guide, ever. A row is inserted only the first time; every
  // subsequent approval conflicts on UNIQUE (guide_id) and inserts nothing.
  const claimRes = await client.query<{ id: string }>(
    `INSERT INTO guide_author_claims (guide_id, user_id, diamonds)
     VALUES ($1, $2, $3)
     ON CONFLICT (guide_id) DO NOTHING
     RETURNING id`,
    [guideId, authorId, GUIDE_VERIFIED_AUTHOR_REWARD],
  );

  if (claimRes.rows.length === 0) {
    return { awarded: false, diamonds: 0, authorId };
  }

  await creditShards(client, authorId, GUIDE_VERIFIED_AUTHOR_REWARD);
  return { awarded: true, diamonds: GUIDE_VERIFIED_AUTHOR_REWARD, authorId };
}
