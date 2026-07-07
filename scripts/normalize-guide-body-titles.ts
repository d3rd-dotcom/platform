/**
 * Normalize guide body titles in the database: null out the first block's
 * title when it matches the guide's topicTitle (case-insensitive, trimmed).
 *
 * This is the data-level fix for the redundant-title render guard in
 * GuideBody.tsx. The render guard is the fail-safe; this keeps content clean
 * at the source.
 *
 * Idempotent — re-running is a no-op on already-clean rows.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/normalize-guide-body-titles.ts
 */
import { isDbConfigured, sqlQuery } from '../lib/db';

interface GuideRow {
  id: string;
  topic_title: string;
  body: unknown;
}

interface GuideBodyComponent {
  id: string;
  componentType: string;
  title?: string;
  config: Record<string, unknown>;
  blocks?: Array<Record<string, unknown>>;
}

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

async function main() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  const rows = await sqlQuery<GuideRow[]>(
    `SELECT id, topic_title, body FROM guides ORDER BY topic_title ASC`,
  );

  let fixed = 0;
  let skipped = 0;

  for (const row of rows) {
    const body = parseBody(row.body);
    if (body.length === 0) {
      skipped++;
      continue;
    }

    const first = body[0];
    if (!first.title) {
      skipped++;
      continue;
    }

    const titleMatch =
      first.title.trim().toLowerCase() === row.topic_title.trim().toLowerCase();

    if (!titleMatch) {
      skipped++;
      continue;
    }

    // Null out the title on the first block.
    body[0] = { ...first, title: undefined };

    await sqlQuery(
      `UPDATE guides SET body = :body::jsonb, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
      { body: JSON.stringify(body), id: row.id },
    );

    console.log(`  fixed  "${row.topic_title}" — removed redundant first-block title`);
    fixed++;
  }

  console.log(`\nDone. ${fixed} guide(s) updated, ${skipped} skipped.`);
}

main().catch((err) => {
  console.error('Error normalizing guide body titles:', err);
  process.exit(1);
});
