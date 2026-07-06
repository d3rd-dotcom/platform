import { sqlQuery } from './db';

/**
 * Phase 8 — Verifier Prestige Track data access.
 *
 * A read-only "prestige" layer over the verifier-jury tables from
 * db/migration-guide-verification.sql (verifier_credentials, verifier_panels,
 * verifier_panel_members, verifier_panel_votes) and the dispute layer from
 * db/migration-guide-disputes.sql (guide_disputes).
 *
 * This module NEVER writes. It only aggregates a member's verifier standing:
 *   - credentials held (subject + level)
 *   - panels served on
 *   - votes cast
 *   - "upheld rate": of the votes the member cast on RESOLVED panels, the
 *     fraction whose decision matched the panel's final decision AND whose guide
 *     was not subsequently overturned by a dispute.
 *
 * It does NOT touch lib/guide-verification-db.ts or any other lib. The leaderboard
 * slice mirrors the users join used by app/api/leaderboard/route.ts.
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface PrestigeCredential {
  subject: string;
  maxLevel: number;
  earnedVia: string;
}

export interface VerifierStats {
  panelsServed: number;
  votesCast: number;
  /** Votes cast on panels that have RESOLVED (approved/rejected). */
  resolvedVotes: number;
  /** Resolved votes that matched the panel decision AND were not overturned. */
  upheldVotes: number;
  /** upheldVotes / resolvedVotes, as a 0–1 float. 0 when no resolved votes. */
  upheldRate: number;
  credentials: PrestigeCredential[];
}

export interface TopVerifier {
  rank: number;
  username: string;
  avatarUrl: string | null;
  panelsServed: number;
  upheldRate: number;
  /** Ranking score = panelsServed * upheldRate. */
  score: number;
}

// ── Shared SQL fragments ─────────────────────────────────────────────────────

/**
 * A member's vote is "upheld" when:
 *   1. its panel has resolved (verifier_panels.status IN ('approved','rejected')), and
 *   2. the member's decision matched the panel's final decision
 *      (approve ↔ approved, reject ↔ rejected), and
 *   3. the panel's guide was NOT later overturned by a dispute — i.e. no
 *      guide_disputes row for that guide reached 'resolved_overturned'
 *      (the majority-'overturn' verdict outcome).
 *
 * `upheld_expr` evaluates to 1 for an upheld vote, else 0.
 * `resolved_expr` evaluates to 1 for any vote on a resolved panel.
 */
const UPHELD_RATE_CTE = `
  vote_outcomes AS (
    SELECT
      vpv.user_id,
      p.guide_id,
      CASE WHEN p.status IN ('approved', 'rejected') THEN 1 ELSE 0 END AS is_resolved,
      CASE
        WHEN (
          (vpv.decision = 'approve' AND p.status = 'approved')
          OR (vpv.decision = 'reject'  AND p.status = 'rejected')
        )
        AND NOT EXISTS (
          SELECT 1 FROM guide_disputes gd
          WHERE gd.guide_id = p.guide_id
            AND gd.status = 'resolved_overturned'
        )
        THEN 1 ELSE 0
      END AS is_upheld
    FROM verifier_panel_votes vpv
    JOIN verifier_panels p ON p.id = vpv.panel_id
  )
`;

// ── getVerifierStats ─────────────────────────────────────────────────────────

/**
 * Full verifier standing for one user: credentials, panels served, votes cast,
 * and the upheld rate over resolved votes.
 */
export async function getVerifierStats(userId: string): Promise<VerifierStats> {
  const credRows = await sqlQuery<Array<{
    subject: string;
    max_level: number;
    earned_via: string;
  }>>(
    `SELECT subject, max_level, earned_via
     FROM verifier_credentials
     WHERE user_id = :userId
     ORDER BY max_level DESC, subject ASC`,
    { userId },
  );

  const aggRows = await sqlQuery<Array<{
    panels_served: number;
    votes_cast: number;
    resolved_votes: number;
    upheld_votes: number;
  }>>(
    `WITH ${UPHELD_RATE_CTE}
     SELECT
       (SELECT COUNT(*)::int FROM verifier_panel_members m WHERE m.user_id = :userId) AS panels_served,
       (SELECT COUNT(*)::int FROM verifier_panel_votes v  WHERE v.user_id = :userId) AS votes_cast,
       COALESCE(SUM(vo.is_resolved), 0)::int AS resolved_votes,
       COALESCE(SUM(vo.is_upheld), 0)::int   AS upheld_votes
     FROM vote_outcomes vo
     WHERE vo.user_id = :userId`,
    { userId },
  );

  const agg = aggRows[0] ?? {
    panels_served: 0,
    votes_cast: 0,
    resolved_votes: 0,
    upheld_votes: 0,
  };

  const resolvedVotes = agg.resolved_votes ?? 0;
  const upheldVotes = agg.upheld_votes ?? 0;
  const upheldRate = resolvedVotes > 0 ? upheldVotes / resolvedVotes : 0;

  return {
    panelsServed: agg.panels_served ?? 0,
    votesCast: agg.votes_cast ?? 0,
    resolvedVotes,
    upheldVotes,
    upheldRate,
    credentials: credRows.map((r) => ({
      subject: r.subject,
      maxLevel: r.max_level,
      earnedVia: r.earned_via,
    })),
  };
}

// ── getTopVerifiers ──────────────────────────────────────────────────────────

/**
 * Leaderboard slice of the most prestigious verifiers, ranked by
 * (panels served * upheld rate). Joins `users` for username/avatar exactly like
 * the main leaderboard query (app/api/leaderboard/route.ts). Members who have
 * never served on a panel are excluded.
 */
export async function getTopVerifiers(limit = 20): Promise<TopVerifier[]> {
  const capped = Math.max(1, Math.min(100, Math.trunc(limit) || 20));

  const rows = await sqlQuery<Array<{
    username: string;
    avatar_url: string | null;
    panels_served: number;
    resolved_votes: number;
    upheld_votes: number;
  }>>(
    `WITH ${UPHELD_RATE_CTE},
     panels_per_user AS (
       SELECT user_id, COUNT(*)::int AS panels_served
       FROM verifier_panel_members
       GROUP BY user_id
     ),
     upheld_per_user AS (
       SELECT
         user_id,
         COALESCE(SUM(is_resolved), 0)::int AS resolved_votes,
         COALESCE(SUM(is_upheld), 0)::int   AS upheld_votes
       FROM vote_outcomes
       GROUP BY user_id
     )
     SELECT
       u.username,
       u.avatar_url,
       ppu.panels_served,
       COALESCE(upu.resolved_votes, 0) AS resolved_votes,
       COALESCE(upu.upheld_votes, 0)   AS upheld_votes
     FROM panels_per_user ppu
     JOIN users u ON u.id = ppu.user_id
     LEFT JOIN upheld_per_user upu ON upu.user_id = ppu.user_id
     WHERE u.username IS NOT NULL`,
    {},
  );

  return rows
    .map((r) => {
      const upheldRate = r.resolved_votes > 0 ? r.upheld_votes / r.resolved_votes : 0;
      return {
        username: r.username,
        avatarUrl: r.avatar_url,
        panelsServed: r.panels_served,
        upheldRate,
        score: r.panels_served * upheldRate,
      };
    })
    .sort((a, b) => b.score - a.score || b.panelsServed - a.panelsServed)
    .slice(0, capped)
    .map((v, i) => ({ rank: i + 1, ...v }));
}
