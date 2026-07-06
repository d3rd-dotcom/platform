import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, PoolClient } from 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// DB-gated integration tests for guide reward payouts
// (lib/guide-rewards-db.ts:awardGuideRewards). Skipped unless TEST_DATABASE_URL
// is set.
//
// awardGuideRewards reads its pool from lib/db.ts, which is keyed on
// DATABASE_URL/POSTGRES_* and cached as a singleton — the brief forbids setting
// DATABASE_URL. So this suite re-runs the SAME closure + tiered-claim logic
// (copied verbatim from lib/guide-rewards-db.ts) against a dedicated pg Pool on
// TEST_DATABASE_URL, inside a throwaway schema dropped in afterAll. The reward
// constants mirror the module: base 50, level_clear 3x = 150, walkthrough 10x =
// 500, plus a 10-diamond spin-equivalent -> walkthrough claim row = 510.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const SCHEMA = 'mwa_test_rewards';

// Constants copied from lib/guide-rewards-db.ts.
const GUIDE_COMPLETE_REWARD = 50;
const LEVEL_CLEAR_REWARD = GUIDE_COMPLETE_REWARD * 3; // 150
const WALKTHROUGH_COMPLETE_REWARD = GUIDE_COMPLETE_REWARD * 10; // 500
const SPIN_COST = 10;
const WALKTHROUGH_PAYOUT = WALKTHROUGH_COMPLETE_REWARD + SPIN_COST; // 510

const PREREQ_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username VARCHAR(80),
    shard_count INTEGER NOT NULL DEFAULT 0
  );
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
`;

// guide_diamond_claims — the idempotency ledger awardGuideRewards writes to.
// (Lives in a separate rewards migration in the app; recreated minimally here.)
const CLAIMS_SQL = `
  CREATE TABLE IF NOT EXISTS guide_diamond_claims (
    id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id CHAR(36) NOT NULL,
    guide_id CHAR(36) NOT NULL,
    claim_type VARCHAR(32) NOT NULL,
    diamonds INTEGER NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (user_id, guide_id, claim_type)
  );
`;

let pool: Pool;
let seq = 0;
const gid = (tag: string) => `rw-${tag}-${(seq++).toString().padStart(30, '0')}`.slice(0, 36);

// Verbatim port of lib/guide-rewards-db.ts:awardGuideRewards, run on `client`.
async function awardGuideRewards(client: PoolClient, userId: string, guideId: string) {
  const closureRes = await client.query<{ id: string; level: number }>(
    `
    WITH RECURSIVE closure AS (
      SELECT $1::char(36) AS id
      UNION
      SELECT e.prereq_id
      FROM guide_edges e
      JOIN closure c ON e.guide_id = c.id
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
      WHERE NOT EXISTS (SELECT 1 FROM sub_edges se WHERE se.guide_id = c.id)
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

  const doneRes = closureIds.length
    ? await client.query<{ guide_id: string }>(
        `SELECT guide_id FROM guide_progress
         WHERE user_id = $1 AND guide_id = ANY($2::char(36)[])`,
        [userId, closureIds],
      )
    : { rows: [] as Array<{ guide_id: string }> };
  const completed = new Set(doneRes.rows.map((r) => r.guide_id));

  const thisNode = closure.find((n) => n.id === guideId);
  const thisLevel = thisNode?.level ?? 0;
  const levelPeers = closure.filter((n) => n.level === thisLevel);
  const levelCleared = levelPeers.length > 0 && levelPeers.every((n) => completed.has(n.id));
  const walkthroughComplete = closure.length > 0 && closure.every((n) => completed.has(n.id));

  let diamonds = 0;
  let awardedLevelClear = false;
  let awardedWalkthrough = false;

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

  if (await claim('guide_complete', GUIDE_COMPLETE_REWARD)) diamonds += GUIDE_COMPLETE_REWARD;
  if (levelCleared && (await claim('level_clear', LEVEL_CLEAR_REWARD))) {
    diamonds += LEVEL_CLEAR_REWARD;
    awardedLevelClear = true;
  }
  if (walkthroughComplete && (await claim('walkthrough_complete', WALKTHROUGH_PAYOUT))) {
    diamonds += WALKTHROUGH_PAYOUT;
    awardedWalkthrough = true;
  }
  if (diamonds > 0) {
    await client.query(`UPDATE users SET shard_count = shard_count + $1 WHERE id = $2`, [
      diamonds,
      userId,
    ]);
  }

  return {
    diamonds,
    levelCleared: awardedLevelClear,
    walkthroughComplete: awardedWalkthrough,
    spinGranted: awardedWalkthrough,
  };
}

// Record a completion then award — the module contract requires guide_progress to
// already include the just-completed guide before awardGuideRewards runs.
async function completeAndAward(userId: string, guideId: string) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO guide_progress (user_id, guide_id) VALUES ($1, $2)
       ON CONFLICT (user_id, guide_id) DO NOTHING`,
      [userId, guideId],
    );
    const result = await awardGuideRewards(client, userId, guideId);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function shardCount(userId: string): Promise<number> {
  const { rows } = await pool.query<{ shard_count: number }>(
    `SELECT shard_count FROM users WHERE id = $1`,
    [userId],
  );
  return Number(rows[0]?.shard_count ?? 0);
}

describe.skipIf(!TEST_DB_URL)('guide rewards (integration)', () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DB_URL,
      ssl:
        TEST_DB_URL && (TEST_DB_URL.includes('supabase.co') || TEST_DB_URL.includes('supabase.com'))
          ? { rejectUnauthorized: false }
          : undefined,
      max: 4,
    });
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await pool.query(`SET search_path TO ${SCHEMA}, public`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await pool.query(PREREQ_SQL);
    const migration = readFileSync(resolve(__dirname, '../../supabase/migrations/20260705090000_guides_dag.sql'), 'utf8');
    await pool.query(migration);
    await pool.query(CLAIMS_SQL);
    await pool.query(`SET search_path TO ${SCHEMA}, public`);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
      await pool.end();
    }
  });

  it('is idempotent: a second completion awards 0', async () => {
    const u = gid('idem-u');
    const g = gid('idem-g');
    await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2)`, [u, 'idem']);
    await pool.query(`INSERT INTO guides (id, slug, topic_title) VALUES ($1, $2, $3)`, [
      g, 'idem-g', 'Idem G',
    ]);

    // Single-node walkthrough: completing it clears its level AND the whole
    // walkthrough at once -> 50 + 150 + 510 = 710.
    const first = await completeAndAward(u, g);
    expect(first.diamonds).toBe(GUIDE_COMPLETE_REWARD + LEVEL_CLEAR_REWARD + WALKTHROUGH_PAYOUT);
    const balanceAfterFirst = await shardCount(u);

    const second = await completeAndAward(u, g);
    expect(second.diamonds).toBe(0);
    expect(second.levelCleared).toBe(false);
    expect(second.walkthroughComplete).toBe(false);
    expect(await shardCount(u)).toBe(balanceAfterFirst);
  });

  it('level_clear fires only when the whole level within the closure completes', async () => {
    // Two level-0 primitives A, B both feed target C (level 1).
    const u = gid('lc-u');
    const a = gid('lc-a');
    const b = gid('lc-b');
    const c = gid('lc-c');
    await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2)`, [u, 'lc']);
    for (const [id, slug, title] of [
      [a, 'lc-a', 'LC A'],
      [b, 'lc-b', 'LC B'],
      [c, 'lc-c', 'LC C'],
    ] as const) {
      await pool.query(`INSERT INTO guides (id, slug, topic_title) VALUES ($1, $2, $3)`, [
        id, slug, title,
      ]);
    }
    await pool.query(`INSERT INTO guide_edges (prereq_id, guide_id) VALUES ($1, $2)`, [a, c]);
    await pool.query(`INSERT INTO guide_edges (prereq_id, guide_id) VALUES ($1, $2)`, [b, c]);

    // Complete A first. A's level (0) still has B outstanding -> no level_clear.
    const rA = await completeAndAward(u, a);
    expect(rA.diamonds).toBe(GUIDE_COMPLETE_REWARD);
    expect(rA.levelCleared).toBe(false);
    expect(rA.walkthroughComplete).toBe(false);

    // Complete B. Now level 0 (A, B) is fully done -> guide_complete + level_clear.
    const rB = await completeAndAward(u, b);
    expect(rB.diamonds).toBe(GUIDE_COMPLETE_REWARD + LEVEL_CLEAR_REWARD);
    expect(rB.levelCleared).toBe(true);
    expect(rB.walkthroughComplete).toBe(false);

    // Complete C (the target, sole node at level 1). Completing C clears level 1
    // AND the whole walkthrough -> guide_complete + level_clear + walkthrough.
    const rC = await completeAndAward(u, c);
    expect(rC.diamonds).toBe(
      GUIDE_COMPLETE_REWARD + LEVEL_CLEAR_REWARD + WALKTHROUGH_PAYOUT,
    );
    expect(rC.levelCleared).toBe(true);
    expect(rC.walkthroughComplete).toBe(true);
    expect(rC.spinGranted).toBe(true);
  });

  it('walkthrough_complete records a single 510-diamond claim row', async () => {
    const u = gid('wt-u');
    const g = gid('wt-g');
    await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2)`, [u, 'wt']);
    await pool.query(`INSERT INTO guides (id, slug, topic_title) VALUES ($1, $2, $3)`, [
      g, 'wt-g', 'WT G',
    ]);
    await completeAndAward(u, g);

    const { rows } = await pool.query<{ diamonds: number }>(
      `SELECT diamonds FROM guide_diamond_claims
       WHERE user_id = $1 AND guide_id = $2 AND claim_type = 'walkthrough_complete'`,
      [u, g],
    );
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].diamonds)).toBe(WALKTHROUGH_PAYOUT); // 510
  });
});
