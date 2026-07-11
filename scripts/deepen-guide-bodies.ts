/**
 * Deepen guide articles so the "What you'll be able to do" list on each guide
 * page is actually backed by the body content.
 *
 * Reads every JSON file in content/guide-drafts/deepen-2026-07/ and applies
 * per-guide updates:
 *   - `blocks`  — replaces guides.body with the given blocks (renderer format)
 *   - `criteria` — replaces guides.evidence_criteria
 * Either field may be omitted; the other is left untouched.
 *
 * Idempotent — re-running writes the same content over itself. Only touches
 * body/evidence_criteria/updated_at; status, edges, and rewards are untouched.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/deepen-guide-bodies.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/deepen-guide-bodies.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { isDbConfigured, sqlQuery } from '../lib/db';

const DRY_RUN = process.argv.includes('--dry-run');
const CONTENT_DIR = path.join(__dirname, '..', 'content', 'guide-drafts', 'deepen-2026-07');

interface BlockUpdate {
  id: string;
  componentType: string;
  title?: string;
  config: { format: string; content: string };
}

interface GuideUpdate {
  slug: string;
  criteria?: string[];
  blocks?: BlockUpdate[];
}

function loadUpdates(): GuideUpdate[] {
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort();
  const updates: GuideUpdate[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const parsed = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected a JSON array`);
    for (const entry of parsed as GuideUpdate[]) {
      if (!entry.slug) throw new Error(`${file}: entry missing slug`);
      if (seen.has(entry.slug)) throw new Error(`Duplicate slug across files: ${entry.slug}`);
      seen.add(entry.slug);
      if (entry.blocks) {
        for (const block of entry.blocks) {
          if (!block.id || !block.componentType || !block.config?.content?.trim()) {
            throw new Error(`${entry.slug}: invalid block ${block.id ?? '(no id)'}`);
          }
        }
      }
      if (entry.criteria && entry.criteria.some((c) => !c.trim())) {
        throw new Error(`${entry.slug}: empty criterion`);
      }
      updates.push(entry);
    }
  }
  return updates;
}

async function main() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  const updates = loadUpdates();
  console.log(`${updates.length} guide update(s) loaded from ${CONTENT_DIR}${DRY_RUN ? ' (dry run)' : ''}`);

  let applied = 0;
  let missing = 0;

  for (const update of updates) {
    const rows = await sqlQuery<Array<{ id: string }>>(
      `SELECT id FROM guides WHERE slug = :slug`,
      { slug: update.slug },
    );
    if (rows.length === 0) {
      console.warn(`  missing "${update.slug}" — no such guide, skipped`);
      missing++;
      continue;
    }

    const sets: string[] = [];
    const params: Record<string, unknown> = { slug: update.slug };
    if (update.blocks) {
      sets.push('body = :body::jsonb');
      params.body = JSON.stringify(update.blocks);
    }
    if (update.criteria) {
      sets.push('evidence_criteria = :criteria::jsonb');
      params.criteria = JSON.stringify(update.criteria);
    }
    if (sets.length === 0) {
      console.warn(`  empty  "${update.slug}" — nothing to apply, skipped`);
      continue;
    }

    if (!DRY_RUN) {
      await sqlQuery(
        `UPDATE guides SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE slug = :slug`,
        params,
      );
    }
    console.log(`  ${DRY_RUN ? 'would apply' : 'applied'} "${update.slug}"${update.blocks ? ' body' : ''}${update.criteria ? ' criteria' : ''}`);
    applied++;
  }

  console.log(`\nDone. ${applied} applied, ${missing} missing.`);
}

main().catch((err) => {
  console.error('Error deepening guide bodies:', err);
  process.exit(1);
});
