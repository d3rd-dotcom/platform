import type { PoolClient } from 'pg';
import { sqlQuery, sqlQueryWithClient, withTransaction } from './db';
import { decomposeGuideBody, type AssemblyDraft } from './guide-assembly';
import type { GuideBodyComponent } from './guides-db';

/**
 * Persistence for the Assemble game: materializing a guide's deterministic
 * decomposition (lib/guide-assembly.ts) into guide_assembly_nodes, and reading /
 * writing a learner's run + per-axiom verdicts.
 *
 * This module owns everything EXCEPT the money path — awarding the completion
 * diamond reward lives in lib/guide-rewards-db.ts (awardAssemblyReward), next to
 * the other shard-crediting code, so all `users.shard_count` writes stay in one
 * file and one transactional pattern.
 */

export type AssemblyVerdict = 'approve' | 'flag';

export interface AssemblyAxiomView {
  id: string;
  statement: string;
  hash: string;
  position: number;
  /** This learner's verdict on the axiom, null if not yet answered. */
  verdict: AssemblyVerdict | null;
  /** Community aggregates across all learners (the community-notes signal). */
  approveCount: number;
  flagCount: number;
}

export interface AssemblySectionView {
  id: string;
  label: string | null;
  position: number;
  axioms: AssemblyAxiomView[];
}

export interface AssemblyTree {
  guideId: string;
  contentVersion: string;
  sections: AssemblySectionView[];
  /** Total axioms across all sections. */
  axiomCount: number;
  /** How many axioms this learner has verdicted. */
  verdictCount: number;
  /** Whether this learner has started a run. */
  started: boolean;
  /** Whether this learner already claimed the completion reward. */
  claimed: boolean;
}

interface NodeRow {
  id: string;
  parent_id: string | null;
  kind: string;
  position: number;
  label: string | null;
  statement: string | null;
  axiom_hash: string | null;
  content_version: string;
}

// ── Materialization ──────────────────────────────────────────────────────────

/**
 * Idempotently materialize a guide's decomposition into guide_assembly_nodes.
 *
 * Deterministic: the same body always yields the same contentVersion, so when
 * the stored nodes already match the freshly computed version this is a no-op.
 * Only a changed body (new contentVersion) triggers a rebuild, which replaces
 * the node set (verdicts cascade away with the old axioms — acceptable, and
 * published guides are edit-locked so this is rare).
 *
 * A per-guide transaction advisory lock serializes concurrent readers so two
 * first-view requests can never double-insert the same decomposition.
 *
 * Returns the draft (its contentVersion is the identity every caller keys on).
 */
export async function materializeAssembly(
  guideId: string,
  body: GuideBodyComponent[],
  topicTitle: string,
): Promise<AssemblyDraft> {
  const draft = decomposeGuideBody(body, topicTitle);

  await withTransaction(async (client) => {
    await sqlQueryWithClient(
      client,
      `SELECT pg_advisory_xact_lock(hashtext(:key))`,
      { key: `guide-assembly:${guideId}` },
    );

    const existing = await sqlQueryWithClient<Array<{ content_version: string }>>(
      client,
      `SELECT DISTINCT content_version FROM guide_assembly_nodes WHERE guide_id = :guideId`,
      { guideId },
    );
    if (existing.length === 1 && existing[0].content_version === draft.contentVersion) {
      return; // already current
    }

    await sqlQueryWithClient(
      client,
      `DELETE FROM guide_assembly_nodes WHERE guide_id = :guideId`,
      { guideId },
    );

    let sectionPos = 0;
    for (const section of draft.sections) {
      const sectionRows = await sqlQueryWithClient<Array<{ id: string }>>(
        client,
        `INSERT INTO guide_assembly_nodes
           (guide_id, parent_id, kind, position, label, content_version)
         VALUES (:guideId, NULL, 'assembly', :position, :label, :cv)
         RETURNING id`,
        { guideId, position: sectionPos, label: section.label, cv: draft.contentVersion },
      );
      const sectionId = sectionRows[0].id;

      let axiomPos = 0;
      for (const axiom of section.axioms) {
        await sqlQueryWithClient(
          client,
          `INSERT INTO guide_assembly_nodes
             (guide_id, parent_id, kind, position, statement, axiom_hash, content_version)
           VALUES (:guideId, :parentId, 'axiom', :position, :statement, :hash, :cv)`,
          {
            guideId,
            parentId: sectionId,
            position: axiomPos,
            statement: axiom.statement,
            hash: axiom.hash,
            cv: draft.contentVersion,
          },
        );
        axiomPos += 1;
      }
      sectionPos += 1;
    }
  });

  return draft;
}

// ── Reads ────────────────────────────────────────────────────────────────────

/**
 * Assemble the full tree view for a guide: sections, axioms, this learner's
 * verdicts, community aggregates, and run/claim state. Assumes the caller has
 * already materialized (getGuideBySlug → materializeAssembly), so it reflects
 * the current body revision.
 */
export async function getAssemblyTree(
  guideId: string,
  userId: string | null,
): Promise<AssemblyTree> {
  const nodes = await sqlQuery<NodeRow[]>(
    `SELECT id, parent_id, kind, position, label, statement, axiom_hash, content_version
     FROM guide_assembly_nodes
     WHERE guide_id = :guideId
     ORDER BY position ASC`,
    { guideId },
  );
  const contentVersion = nodes[0]?.content_version ?? '';

  // Community aggregates per axiom.
  const aggRows = await sqlQuery<Array<{ node_id: string; verdict: string; count: number }>>(
    `SELECT v.node_id, v.verdict, COUNT(*)::int AS count
     FROM guide_assembly_verdicts v
     JOIN guide_assembly_nodes n ON n.id = v.node_id
     WHERE n.guide_id = :guideId
     GROUP BY v.node_id, v.verdict`,
    { guideId },
  );
  const approveCounts = new Map<string, number>();
  const flagCounts = new Map<string, number>();
  for (const r of aggRows) {
    if (r.verdict === 'approve') approveCounts.set(r.node_id, r.count);
    else if (r.verdict === 'flag') flagCounts.set(r.node_id, r.count);
  }

  // This learner's verdicts + run/claim state.
  const mine = new Map<string, AssemblyVerdict>();
  let started = false;
  let claimed = false;
  if (userId) {
    const [runRows, claimRows] = await Promise.all([
      sqlQuery<Array<{ id: string }>>(
        `SELECT id FROM guide_assembly_runs WHERE user_id = :userId AND guide_id = :guideId`,
        { userId, guideId },
      ),
      sqlQuery<Array<{ id: string }>>(
        `SELECT id FROM guide_assembly_claims WHERE user_id = :userId AND guide_id = :guideId`,
        { userId, guideId },
      ),
    ]);
    claimed = claimRows.length > 0;
    if (runRows[0]) {
      started = true;
      const verdicts = await sqlQuery<Array<{ node_id: string; verdict: string }>>(
        `SELECT node_id, verdict FROM guide_assembly_verdicts WHERE run_id = :runId`,
        { runId: runRows[0].id },
      );
      for (const v of verdicts) {
        if (v.verdict === 'approve' || v.verdict === 'flag') mine.set(v.node_id, v.verdict);
      }
    }
  }

  // Build the section→axiom tree from the flat node list.
  const sectionsById = new Map<string, AssemblySectionView>();
  const sections: AssemblySectionView[] = [];
  for (const n of nodes) {
    if (n.kind !== 'assembly') continue;
    const section: AssemblySectionView = {
      id: n.id,
      label: n.label,
      position: n.position,
      axioms: [],
    };
    sectionsById.set(n.id, section);
    sections.push(section);
  }

  let axiomCount = 0;
  let verdictCount = 0;
  for (const n of nodes) {
    if (n.kind !== 'axiom' || !n.parent_id) continue;
    const section = sectionsById.get(n.parent_id);
    if (!section) continue;
    const verdict = mine.get(n.id) ?? null;
    if (verdict) verdictCount += 1;
    axiomCount += 1;
    section.axioms.push({
      id: n.id,
      statement: n.statement ?? '',
      hash: n.axiom_hash ?? '',
      position: n.position,
      verdict,
      approveCount: approveCounts.get(n.id) ?? 0,
      flagCount: flagCounts.get(n.id) ?? 0,
    });
  }
  for (const section of sections) {
    section.axioms.sort((a, b) => a.position - b.position);
  }

  return {
    guideId,
    contentVersion,
    sections,
    axiomCount,
    verdictCount,
    started,
    claimed,
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────

/**
 * Upsert the learner's run row for a guide, returning it. started_at is stamped
 * on first creation (drives the reward time gate) and is never moved; the run's
 * content_version is kept in step with the current decomposition.
 */
async function ensureRun(
  client: PoolClient,
  userId: string,
  guideId: string,
  contentVersion: string,
): Promise<{ id: string; started_at: string }> {
  const rows = await sqlQueryWithClient<Array<{ id: string; started_at: string }>>(
    client,
    `INSERT INTO guide_assembly_runs (user_id, guide_id, content_version)
     VALUES (:userId, :guideId, :cv)
     ON CONFLICT (user_id, guide_id)
       DO UPDATE SET content_version = EXCLUDED.content_version
     RETURNING id, started_at`,
    { userId, guideId, cv: contentVersion },
  );
  return rows[0];
}

/**
 * Record (or change) a learner's verdict on one axiom. Validates the node is an
 * axiom of this guide, lazily starts the run (so started_at reflects real play,
 * not page load), and upserts the verdict. Idempotent per (run, node).
 */
export async function recordAssemblyVerdict(
  userId: string,
  guideId: string,
  contentVersion: string,
  nodeId: string,
  verdict: AssemblyVerdict,
): Promise<{ ok: true }> {
  return withTransaction(async (client) => {
    const nodeRows = await sqlQueryWithClient<Array<{ id: string }>>(
      client,
      `SELECT id FROM guide_assembly_nodes
       WHERE id = :nodeId AND guide_id = :guideId AND kind = 'axiom'`,
      { nodeId, guideId },
    );
    if (!nodeRows[0]) {
      throw Object.assign(new Error('That axiom is not part of this guide.'), { status: 400 });
    }

    const run = await ensureRun(client, userId, guideId, contentVersion);
    await sqlQueryWithClient(
      client,
      `INSERT INTO guide_assembly_verdicts (run_id, node_id, verdict)
       VALUES (:runId, :nodeId, :verdict)
       ON CONFLICT (run_id, node_id)
         DO UPDATE SET verdict = EXCLUDED.verdict, updated_at = CURRENT_TIMESTAMP`,
      { runId: run.id, nodeId, verdict },
    );
    return { ok: true };
  });
}
