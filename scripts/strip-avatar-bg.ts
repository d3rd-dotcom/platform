/**
 * Strips the hard-coded `backgroundColor=5168ff` param from all stored DiceBear
 * avatar URLs in the `users` and `user_avatars` tables.
 *
 * The code (lib/avatars.ts) no longer includes a background colour in the
 * DiceBear shape-grid URLs, but existing rows in the database still have the
 * old URL with the baked-in background.
 *
 * Run a preview first:   npx tsx scripts/strip-avatar-bg.ts --dry-run
 * Then apply for real:   npx tsx scripts/strip-avatar-bg.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { isDbConfigured, sqlQuery } from '../lib/db';
import { ensureForumSchema } from '../lib/ensureForumSchema';

const DRY_RUN = process.argv.includes('--dry-run');

// Matches any DiceBear URL that has backgroundColor=5168ff
const BG_PATTERN = '%backgroundColor=5168ff%';
const BG_PARAM = 'backgroundColor=5168ff';

async function stripBgFromTable(
  table: string,
  column: string,
  label: string
): Promise<{ total: number; updated: number }> {
  // Count rows that have the stale param
  const countResult = await sqlQuery<Array<{ cnt: number }>>(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${column} LIKE :pattern`,
    { pattern: BG_PATTERN }
  );
  const total = Number(countResult[0]?.cnt ?? 0);
  console.log(`  ${label}: ${total} row(s) with stale background URL`);

  if (total === 0) return { total: 0, updated: 0 };

  if (DRY_RUN) {
    return { total, updated: 0 };
  }

  // Strip the background colour param — handles both ?backgroundColor=... and &backgroundColor=...
  const result = await sqlQuery(
    `UPDATE ${table}
        SET ${column} = REPLACE(REPLACE(${column}, '?${BG_PARAM}', ''), '&${BG_PARAM}', '')
      WHERE ${column} LIKE :pattern`,
    { pattern: BG_PATTERN }
  );

  // pg-mem / pg compatible: result might be { rowCount, rows } or an array with affectedRows
  const changed = (result as any).rowCount ?? (result as any).affectedRows ?? 0;
  console.log(`  ${label}: updated ${changed} row(s)`);
  return { total, updated: changed };
}

async function migrate() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  await ensureForumSchema();

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Stripping backgroundColor=5168ff from avatar URLs...\n`);

  const usersResult = await stripBgFromTable('users', 'avatar_url', 'users.avatar_url');
  const uaResult = await stripBgFromTable('user_avatars', 'avatar_url', 'user_avatars.avatar_url');

  const totalRows = usersResult.total + uaResult.total;
  const totalUpdated = usersResult.updated + uaResult.updated;

  console.log(
    `\nDone. ${DRY_RUN ? 'Would affect' : 'Updated'} ${totalRows} row(s)` +
      (DRY_RUN ? '  (dry run — no writes made)' : `  (${totalUpdated} actually changed)`)
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
