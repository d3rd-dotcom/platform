import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

// ─────────────────────────────────────────────────────────────────────────────
// DB-gated integration tests for the guide DAG schema
// (db/migration-guides.sql). Skipped entirely unless TEST_DATABASE_URL is set,
// so `npm test` is green on a machine with no database.
//
// We connect a DEDICATED pg Pool to TEST_DATABASE_URL — never DATABASE_URL — and
// run the whole suite inside a throwaway schema (mwa_test_guides) that is dropped
// in afterAll, so nothing leaks into the target database. lib/db.ts reads its
// connection from DATABASE_URL/POSTGRES_* env vars and caches a singleton pool;
// pointing it at the test DB would require mutating DATABASE_URL, which the brief
// forbids. So the recursive level CTE under test is copied verbatim from
// lib/guides-db.ts:getWalkthrough and run through this pool instead.
// ─────────────────────────────────────────────────────────────────────────────

const TEST_DB_URL = process.env.TEST_DATABASE_URL;
const SCHEMA = 'mwa_test_guides';

// The migration references users(id) and update_updated_at_column(); we create
// minimal stand-ins in the throwaway schema before running it.
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

// Copied verbatim from lib/guides-db.ts:getWalkthrough — the closure + longest-path
// level CTE. Parameterised on $1 = target guide id.
const LEVEL_CTE = `
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
`;

let pool: Pool;

// A CHAR(36)-shaped id generator so ids fit the schema's char(36) columns.
let seq = 0;
const gid = (tag: string) => `test-${tag}-${(seq++).toString().padStart(28, '0')}`.slice(0, 36);

async function insertGuide(id: string, slug: string, title: string, status = 'draft') {
  await pool.query(
    `INSERT INTO guides (id, slug, topic_title, status) VALUES ($1, $2, $3, $4)`,
    [id, slug, title, status],
  );
}
async function insertEdge(prereqId: string, guideId: string) {
  await pool.query(
    `INSERT INTO guide_edges (prereq_id, guide_id) VALUES ($1, $2)`,
    [prereqId, guideId],
  );
}
async function levels(targetId: string): Promise<Map<string, number>> {
  const res = await pool.query<{ id: string; level: string }>(LEVEL_CTE, [targetId]);
  return new Map(res.rows.map((r) => [r.id, Number(r.level)]));
}

describe.skipIf(!TEST_DB_URL)('guide DAG schema (integration)', () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DB_URL,
      ssl:
        TEST_DB_URL && (TEST_DB_URL.includes('supabase.co') || TEST_DB_URL.includes('supabase.com'))
          ? { rejectUnauthorized: false }
          : undefined,
      max: 4,
    });
    // Fresh throwaway schema; put it first on the search_path.
    await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
    await pool.query(`CREATE SCHEMA ${SCHEMA}`);
    await pool.query(`SET search_path TO ${SCHEMA}, public`);
    await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await pool.query(PREREQ_SQL);

    const migration = readFileSync(
      resolve(__dirname, '../../db/migration-guides.sql'),
      'utf8',
    );
    await pool.query(migration);
    // Re-assert search_path (the migration issues no SET, but be defensive).
    await pool.query(`SET search_path TO ${SCHEMA}, public`);
  });

  afterAll(async () => {
    if (pool) {
      await pool.query(`DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`).catch(() => {});
      await pool.end();
    }
  });

  it('(a) cycle-guard trigger rejects an edge that closes a loop A->B->C->A', async () => {
    const a = gid('cyc-a');
    const b = gid('cyc-b');
    const c = gid('cyc-c');
    await insertGuide(a, 'cyc-a', 'Cyc A');
    await insertGuide(b, 'cyc-b', 'Cyc B');
    await insertGuide(c, 'cyc-c', 'Cyc C');
    // A->B->C is a valid chain.
    await insertEdge(a, b);
    await insertEdge(b, c);
    // Closing the loop C->A must be rejected by the trigger.
    await expect(insertEdge(c, a)).rejects.toThrow(/cycle/i);
  });

  it('(b) self-edge CHECK rejects prereq == guide', async () => {
    const x = gid('self');
    await insertGuide(x, 'self', 'Self');
    await expect(insertEdge(x, x)).rejects.toThrow();
  });

  describe('(c) guide_votes rubric constraint', () => {
    it('rejects a downvote WITHOUT a rubric_reason', async () => {
      const g = gid('vote-dn');
      const u = gid('user-dn');
      await insertGuide(g, 'vote-dn', 'Vote Down');
      await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2)`, [u, 'u-dn']);
      await expect(
        pool.query(
          `INSERT INTO guide_votes (user_id, guide_id, direction, rubric_reason)
           VALUES ($1, $2, 'down', NULL)`,
          [u, g],
        ),
      ).rejects.toThrow();
    });

    it('rejects an upvote WITH a rubric_reason', async () => {
      const g = gid('vote-up');
      const u = gid('user-up');
      await insertGuide(g, 'vote-up', 'Vote Up');
      await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2)`, [u, 'u-up']);
      await expect(
        pool.query(
          `INSERT INTO guide_votes (user_id, guide_id, direction, rubric_reason)
           VALUES ($1, $2, 'up', 'unclear')`,
          [u, g],
        ),
      ).rejects.toThrow();
    });

    it('accepts a valid downvote (with reason) and a valid upvote (no reason)', async () => {
      const g = gid('vote-ok');
      const uUp = gid('user-ok-up');
      const uDn = gid('user-ok-dn');
      await insertGuide(g, 'vote-ok', 'Vote OK');
      await pool.query(`INSERT INTO users (id, username) VALUES ($1, $2), ($3, $4)`, [
        uUp, 'ok-up', uDn, 'ok-dn',
      ]);
      await pool.query(
        `INSERT INTO guide_votes (user_id, guide_id, direction, rubric_reason)
         VALUES ($1, $2, 'up', NULL)`,
        [uUp, g],
      );
      await pool.query(
        `INSERT INTO guide_votes (user_id, guide_id, direction, rubric_reason)
         VALUES ($1, $2, 'down', 'factually_wrong')`,
        [uDn, g],
      );
      const { rows } = await pool.query<{ direction: string }>(
        `SELECT direction FROM guide_votes WHERE guide_id = $1 ORDER BY direction`,
        [g],
      );
      expect(rows.map((r) => r.direction)).toEqual(['down', 'up']);
    });
  });

  describe('(d) recursive level CTE', () => {
    it('computes levels 0/1/2 for a 3-level chain A->B->C', async () => {
      const a = gid('lvl-a');
      const b = gid('lvl-b');
      const c = gid('lvl-c');
      await insertGuide(a, 'lvl-a', 'Lvl A');
      await insertGuide(b, 'lvl-b', 'Lvl B');
      await insertGuide(c, 'lvl-c', 'Lvl C');
      await insertEdge(a, b); // A prereq of B
      await insertEdge(b, c); // B prereq of C
      const lvl = await levels(c);
      expect(lvl.get(a)).toBe(0);
      expect(lvl.get(b)).toBe(1);
      expect(lvl.get(c)).toBe(2);
    });

    it('takes the LONGEST path in a diamond with an extra chain (D = level 3, not 2)', async () => {
      // Diamond: A->B, A->C, B->D, C->D. Plus a longer chain A->X->Y->D.
      //   Shortest path to D is 2 (A->B->D); longest is 3 (A->X->Y->D).
      const a = gid('dia-a');
      const b = gid('dia-b');
      const c = gid('dia-c');
      const d = gid('dia-d');
      const x = gid('dia-x');
      const y = gid('dia-y');
      for (const [id, slug, title] of [
        [a, 'dia-a', 'Dia A'],
        [b, 'dia-b', 'Dia B'],
        [c, 'dia-c', 'Dia C'],
        [d, 'dia-d', 'Dia D'],
        [x, 'dia-x', 'Dia X'],
        [y, 'dia-y', 'Dia Y'],
      ] as const) {
        await insertGuide(id, slug, title);
      }
      await insertEdge(a, b);
      await insertEdge(a, c);
      await insertEdge(b, d);
      await insertEdge(c, d);
      await insertEdge(a, x);
      await insertEdge(x, y);
      await insertEdge(y, d);

      const lvl = await levels(d);
      expect(lvl.get(a)).toBe(0);
      expect(lvl.get(b)).toBe(1);
      expect(lvl.get(c)).toBe(1);
      expect(lvl.get(x)).toBe(1);
      expect(lvl.get(y)).toBe(2);
      // D's level is the MAX over all incoming paths: longest = A->X->Y->D = 3.
      expect(lvl.get(d)).toBe(3);
    });
  });
});
