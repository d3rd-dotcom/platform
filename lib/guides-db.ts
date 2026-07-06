import { sqlQuery } from './db';
import {
  GUIDE_COMPLETE_REWARD,
  LEVEL_CLEAR_REWARD,
  WALKTHROUGH_COMPLETE_REWARD,
} from './guide-rewards-db';

// ── Types ────────────────────────────────────────────────────────────────────

export type GuideStatus =
  | 'draft'
  | 'pending_verification'
  | 'published'
  | 'unpublished'
  | 'forked';

/**
 * A guide body is an array of course components in the same shape consumed by
 * components/course-renderers/ComponentRenderer.tsx. We keep it loosely typed
 * (Record) so the renderers' own config typing stays the single source of truth.
 */
export type GuideBodyComponent = {
  id: string;
  componentType: string;
  title?: string;
  config: Record<string, unknown>;
  blocks?: Array<Record<string, unknown>>;
};

export interface GuideRecord {
  id: string;
  slug: string;
  topicTitle: string;
  body: GuideBodyComponent[];
  status: GuideStatus;
  authorId: string | null;
  canonicalGroupId: string | null;
  subjects: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GuideMethodRecord {
  id: string;
  parentGuideId: string;
  title: string;
  body: GuideBodyComponent[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface GuideLink {
  id: string;
  slug: string;
  topicTitle: string;
  status: GuideStatus;
}

export interface WalkthroughNode extends GuideLink {
  level: number;
  prereqIds: string[];
  completed: boolean;
}

export interface WalkthroughRewardPreview {
  guideComplete: number;
  levelClear: number;
  walkthroughComplete: number;
  spinGranted: boolean;
}

export interface Walkthrough {
  targetId: string;
  levels: number; // total number of levels (max level + 1)
  nodes: WalkthroughNode[];
  rewardPreview: WalkthroughRewardPreview;
}

// ── Row types ────────────────────────────────────────────────────────────────

interface GuideRow {
  id: string;
  slug: string;
  topic_title: string;
  body: unknown;
  status: string;
  author_id: string | null;
  canonical_group_id: string | null;
  created_at: string;
  updated_at: string;
}

interface GuideMethodRow {
  id: string;
  parent_guide_id: string;
  title: string;
  body: unknown;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ── Parsers / mappers ────────────────────────────────────────────────────────

function parseBody(raw: unknown): GuideBodyComponent[] {
  if (!raw) return [];
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) ? (value as GuideBodyComponent[]) : [];
}

function toGuide(row: GuideRow, subjects: string[] = []): GuideRecord {
  return {
    id: row.id,
    slug: row.slug,
    topicTitle: row.topic_title,
    body: parseBody(row.body),
    status: (row.status as GuideStatus) || 'draft',
    authorId: row.author_id,
    canonicalGroupId: row.canonical_group_id,
    subjects,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toMethod(row: GuideMethodRow): GuideMethodRecord {
  return {
    id: row.id,
    parentGuideId: row.parent_guide_id,
    title: row.title,
    body: parseBody(row.body),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSubjectsForGuides(guideIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (guideIds.length === 0) return map;
  const rows = await sqlQuery<Array<{ guide_id: string; subject: string }>>(
    `SELECT guide_id, subject FROM guide_subjects
     WHERE guide_id = ANY(:ids)
     ORDER BY subject ASC`,
    { ids: guideIds },
  );
  for (const r of rows) {
    const list = map.get(r.guide_id);
    if (list) list.push(r.subject);
    else map.set(r.guide_id, [r.subject]);
  }
  return map;
}

// ── Reads ────────────────────────────────────────────────────────────────────

export async function getGuideBySlug(slug: string): Promise<GuideRecord | null> {
  const rows = await sqlQuery<GuideRow[]>(
    `SELECT * FROM guides WHERE slug = :slug`,
    { slug },
  );
  if (!rows[0]) return null;
  const subjects = await getSubjectsForGuides([rows[0].id]);
  return toGuide(rows[0], subjects.get(rows[0].id) ?? []);
}

export async function listGuides(filter?: {
  subject?: string;
  status?: GuideStatus;
  statuses?: GuideStatus[];
  authorId?: string;
}): Promise<GuideRecord[]> {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};

  if (filter?.status) {
    clauses.push('g.status = :status');
    params.status = filter.status;
  }
  if (filter?.statuses && filter.statuses.length > 0) {
    clauses.push('g.status = ANY(:statuses)');
    params.statuses = filter.statuses;
  }
  if (filter?.authorId) {
    clauses.push('g.author_id = :authorId');
    params.authorId = filter.authorId;
  }
  if (filter?.subject) {
    clauses.push(
      'EXISTS (SELECT 1 FROM guide_subjects gs WHERE gs.guide_id = g.id AND gs.subject = :subject)',
    );
    params.subject = filter.subject;
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await sqlQuery<GuideRow[]>(
    `SELECT g.* FROM guides g ${where} ORDER BY g.topic_title ASC`,
    params,
  );
  const subjects = await getSubjectsForGuides(rows.map((r) => r.id));
  return rows.map((r) => toGuide(r, subjects.get(r.id) ?? []));
}

export async function getGuideMethods(guideId: string): Promise<GuideMethodRecord[]> {
  const rows = await sqlQuery<GuideMethodRow[]>(
    `SELECT * FROM guide_methods WHERE parent_guide_id = :guideId ORDER BY sort_order ASC, created_at ASC`,
    { guideId },
  );
  return rows.map(toMethod);
}

/** Direct prerequisites of a guide (one hop up). */
export async function getDirectPrereqs(guideId: string): Promise<GuideLink[]> {
  return sqlQuery<GuideLink[]>(
    `SELECT g.id, g.slug, g.topic_title AS "topicTitle", g.status
     FROM guide_edges e
     JOIN guides g ON g.id = e.prereq_id
     WHERE e.guide_id = :guideId
     ORDER BY g.topic_title ASC`,
    { guideId },
  );
}

/** Direct dependents of a guide (one hop down). */
export async function getDirectDependents(guideId: string): Promise<GuideLink[]> {
  return sqlQuery<GuideLink[]>(
    `SELECT g.id, g.slug, g.topic_title AS "topicTitle", g.status
     FROM guide_edges e
     JOIN guides g ON g.id = e.guide_id
     WHERE e.prereq_id = :guideId
     ORDER BY g.topic_title ASC`,
    { guideId },
  );
}

// ── Writes ───────────────────────────────────────────────────────────────────

export async function createGuide(input: {
  slug: string;
  topicTitle: string;
  body?: GuideBodyComponent[];
  authorId?: string | null;
  status?: GuideStatus;
}): Promise<GuideRecord> {
  const rows = await sqlQuery<GuideRow[]>(
    `INSERT INTO guides (slug, topic_title, body, author_id, status)
     VALUES (:slug, :topicTitle, :body::jsonb, :authorId, :status)
     RETURNING *`,
    {
      slug: input.slug,
      topicTitle: input.topicTitle,
      body: JSON.stringify(input.body ?? []),
      authorId: input.authorId ?? null,
      status: input.status ?? 'draft',
    },
  );
  return toGuide(rows[0], []);
}

/**
 * Updates a guide's editable content (topic title, body, subjects). Author-only
 * enforcement lives in the route; this function just writes. Subjects, when
 * provided, fully replace the existing set. The slug is intentionally immutable
 * after creation (it's the guide's public URL and canonical identity).
 */
export async function updateGuide(input: {
  id: string;
  topicTitle?: string;
  body?: GuideBodyComponent[];
  subjects?: string[];
}): Promise<GuideRecord> {
  const sets: string[] = [];
  const params: Record<string, unknown> = { id: input.id };

  if (typeof input.topicTitle === 'string') {
    sets.push('topic_title = :topicTitle');
    params.topicTitle = input.topicTitle;
  }
  if (input.body !== undefined) {
    sets.push('body = :body::jsonb');
    params.body = JSON.stringify(input.body);
  }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    await sqlQuery(
      `UPDATE guides SET ${sets.join(', ')} WHERE id = :id`,
      params,
    );
  }

  if (input.subjects !== undefined) {
    await setGuideSubjects(input.id, input.subjects);
  }

  const rows = await sqlQuery<GuideRow[]>(`SELECT * FROM guides WHERE id = :id`, { id: input.id });
  if (!rows[0]) {
    throw Object.assign(new Error('Guide not found.'), { status: 404 });
  }
  const subjects = await getSubjectsForGuides([input.id]);
  return toGuide(rows[0], subjects.get(input.id) ?? []);
}

/**
 * Replaces a guide's subject tags with the given (deduped, trimmed) set.
 */
export async function setGuideSubjects(guideId: string, subjects: string[]): Promise<void> {
  const cleaned = Array.from(
    new Set(subjects.map((s) => s.trim()).filter(Boolean)),
  ).slice(0, 24);

  await sqlQuery(`DELETE FROM guide_subjects WHERE guide_id = :guideId`, { guideId });
  for (const subject of cleaned) {
    await sqlQuery(
      `INSERT INTO guide_subjects (guide_id, subject) VALUES (:guideId, :subject)
       ON CONFLICT (guide_id, subject) DO NOTHING`,
      { guideId, subject },
    );
  }
}

/**
 * Adds a prerequisite edge (prereqId → guideId). The DB cycle-guard trigger
 * rejects edges that would introduce a cycle by raising a P0001 exception; the
 * calling route catches that and surfaces a clean 400. Idempotent on the unique
 * (prereq_id, guide_id) pair.
 */
export async function addGuidePrereq(guideId: string, prereqId: string): Promise<void> {
  if (guideId === prereqId) {
    throw Object.assign(new Error('A guide cannot be its own prerequisite.'), { status: 400 });
  }
  await sqlQuery(
    `INSERT INTO guide_edges (prereq_id, guide_id) VALUES (:prereqId, :guideId)
     ON CONFLICT (prereq_id, guide_id) DO NOTHING`,
    { guideId, prereqId },
  );
}

/**
 * Removes a prerequisite edge (prereqId → guideId). No-op if the edge is absent.
 */
export async function removeGuidePrereq(guideId: string, prereqId: string): Promise<void> {
  await sqlQuery(
    `DELETE FROM guide_edges WHERE prereq_id = :prereqId AND guide_id = :guideId`,
    { guideId, prereqId },
  );
}

/**
 * Searches PUBLISHED guides by topic title / slug for the prerequisite picker.
 * Excludes the given guide id (a guide can never be its own prereq). Only
 * published guides are eligible prerequisites — a draft can't gate a learner.
 */
export async function searchPublishedGuides(input: {
  query?: string;
  excludeId?: string;
  limit?: number;
}): Promise<GuideLink[]> {
  const clauses: string[] = [`g.status = 'published'`];
  const params: Record<string, unknown> = {};

  if (input.excludeId) {
    clauses.push('g.id != :excludeId');
    params.excludeId = input.excludeId;
  }
  if (input.query && input.query.trim()) {
    clauses.push('(g.topic_title ILIKE :q OR g.slug ILIKE :q)');
    params.q = `%${input.query.trim()}%`;
  }

  return sqlQuery<GuideLink[]>(
    `SELECT g.id, g.slug, g.topic_title AS "topicTitle", g.status
     FROM guides g
     WHERE ${clauses.join(' AND ')}
     ORDER BY g.topic_title ASC
     LIMIT :limit`,
    { ...params, limit: Math.min(Math.max(input.limit ?? 20, 1), 50) },
  );
}

// ── Walkthrough + level computation ──────────────────────────────────────────

/**
 * Returns the full transitive prerequisite closure of `targetGuideId`
 * (including the target itself), with a COMPUTED level for each node.
 *
 * Level = longest path from a primitive (a guide with no prerequisites is
 * level 0; every other node is 1 + the max level of its direct prereqs). Because
 * the graph is a DAG (enforced by the guide_edges cycle trigger), the recursion
 * terminates.
 *
 * Recursive CTE strategy:
 *   1. `closure` collects the set of guides reachable by walking prereq edges
 *      upward from the target (the sub-DAG we care about).
 *   2. `lvl` computes longest-path levels within that closure: seed every node
 *      with a level equal to the count of its prereqs *inside the closure* (0 =
 *      a primitive), then relax — whenever a node is reached via one of its
 *      prereqs, its candidate level is prereq.level + 1. We keep the MAX per
 *      node via a final GROUP BY, which yields the longest path.
 */
export async function getWalkthrough(
  targetGuideId: string,
  userId?: string | null,
): Promise<Walkthrough | null> {
  const targetRows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM guides WHERE id = :id`,
    { id: targetGuideId },
  );
  if (!targetRows[0]) return null;

  const rows = await sqlQuery<
    Array<{
      id: string;
      slug: string;
      topicTitle: string;
      status: string;
      level: number;
    }>
  >(
    `
    WITH RECURSIVE closure AS (
      SELECT :target::char(36) AS id
      UNION
      SELECT e.prereq_id
      FROM guide_edges e
      JOIN closure c ON e.guide_id = c.id
    ),
    -- edges that live entirely inside the closure
    sub_edges AS (
      SELECT e.prereq_id, e.guide_id
      FROM guide_edges e
      JOIN closure a ON a.id = e.prereq_id
      JOIN closure b ON b.id = e.guide_id
    ),
    lvl AS (
      -- primitives inside the closure start at level 0
      SELECT c.id, 0 AS level
      FROM closure c
      WHERE NOT EXISTS (
        SELECT 1 FROM sub_edges se WHERE se.guide_id = c.id
      )
      UNION ALL
      -- relax: reaching a node via a prereq gives it prereq.level + 1
      SELECT se.guide_id, l.level + 1
      FROM lvl l
      JOIN sub_edges se ON se.prereq_id = l.id
    )
    SELECT
      g.id,
      g.slug,
      g.topic_title AS "topicTitle",
      g.status,
      MAX(lvl.level) AS level
    FROM lvl
    JOIN guides g ON g.id = lvl.id
    GROUP BY g.id, g.slug, g.topic_title, g.status
    ORDER BY MAX(lvl.level) ASC, g.topic_title ASC
    `,
    { target: targetGuideId },
  );

  const nodeIds = rows.map((r) => r.id);

  // Direct prereqs within the closure, for gate display in the UI.
  const prereqRows = nodeIds.length
    ? await sqlQuery<Array<{ prereq_id: string; guide_id: string }>>(
        `SELECT prereq_id, guide_id FROM guide_edges
         WHERE guide_id = ANY(:ids) AND prereq_id = ANY(:ids)`,
        { ids: nodeIds },
      )
    : [];
  const prereqMap = new Map<string, string[]>();
  for (const r of prereqRows) {
    const list = prereqMap.get(r.guide_id);
    if (list) list.push(r.prereq_id);
    else prereqMap.set(r.guide_id, [r.prereq_id]);
  }

  // Completion state for the viewer.
  const completed = new Set<string>();
  if (userId && nodeIds.length) {
    const doneRows = await sqlQuery<Array<{ guide_id: string }>>(
      `SELECT guide_id FROM guide_progress
       WHERE user_id = :userId AND guide_id = ANY(:ids)`,
      { userId, ids: nodeIds },
    );
    for (const r of doneRows) completed.add(r.guide_id);
  }

  const nodes: WalkthroughNode[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    topicTitle: r.topicTitle,
    status: (r.status as GuideStatus) || 'draft',
    level: Number(r.level) || 0,
    prereqIds: prereqMap.get(r.id) ?? [],
    completed: completed.has(r.id),
  }));

  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  return {
    targetId: targetGuideId,
    levels: nodes.length ? maxLevel + 1 : 0,
    nodes,
    rewardPreview: {
      guideComplete: GUIDE_COMPLETE_REWARD,
      levelClear: LEVEL_CLEAR_REWARD,
      walkthroughComplete: WALKTHROUGH_COMPLETE_REWARD,
      spinGranted: true,
    },
  };
}

// ── Progress ─────────────────────────────────────────────────────────────────

export async function getUserGuideProgress(userId: string): Promise<Set<string>> {
  const rows = await sqlQuery<Array<{ guide_id: string }>>(
    `SELECT guide_id FROM guide_progress WHERE user_id = :userId`,
    { userId },
  );
  return new Set(rows.map((r) => r.guide_id));
}

/**
 * Marks a guide complete for a user, enforcing the gate: every DIRECT prereq of
 * the guide must already be in guide_progress for this user. Throws a 409 error
 * (with .status) listing the missing prereqs otherwise. Idempotent.
 */
export async function completeGuide(
  userId: string,
  guideId: string,
): Promise<{ completedAt: string }> {
  const guideRows = await sqlQuery<Array<{ id: string; topic_title: string }>>(
    `SELECT id, topic_title FROM guides WHERE id = :guideId`,
    { guideId },
  );
  if (!guideRows[0]) {
    throw Object.assign(new Error('Guide not found.'), { status: 404 });
  }

  // Direct prereqs the user has NOT completed yet.
  const missing = await sqlQuery<Array<{ topic_title: string }>>(
    `SELECT p.topic_title
     FROM guide_edges e
     JOIN guides p ON p.id = e.prereq_id
     WHERE e.guide_id = :guideId
       AND NOT EXISTS (
         SELECT 1 FROM guide_progress gp
         WHERE gp.user_id = :userId AND gp.guide_id = e.prereq_id
       )
     ORDER BY p.topic_title ASC`,
    { guideId, userId },
  );

  if (missing.length > 0) {
    const names = missing.map((m) => m.topic_title).join(', ');
    throw Object.assign(
      new Error(`Complete the prerequisite guide(s) first: ${names}.`),
      { status: 409 },
    );
  }

  const rows = await sqlQuery<Array<{ completed_at: string }>>(
    `INSERT INTO guide_progress (user_id, guide_id)
     VALUES (:userId, :guideId)
     ON CONFLICT (user_id, guide_id) DO UPDATE SET completed_at = guide_progress.completed_at
     RETURNING completed_at`,
    { userId, guideId },
  );
  return { completedAt: rows[0].completed_at };
}
