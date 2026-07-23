/**
 * Backfills generated avatar URLs to the same-origin three-axis renderer.
 * Custom uploads and Academic Angel URLs are preserved.
 *
 * Preview: npx tsx scripts/migrate-axis-avatars.ts --dry-run
 * Apply:   npx tsx scripts/migrate-axis-avatars.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { isDbConfigured, sqlQuery } from '../lib/db';

const DRY_RUN = process.argv.includes('--dry-run');
const LEGACY_PATTERN = 'https://api.dicebear.com/%';

async function countRows(table: string): Promise<number> {
  const rows = await sqlQuery<Array<{ count: string | number }>>(
    `SELECT COUNT(*) AS count FROM ${table} WHERE avatar_url LIKE :pattern`,
    { pattern: LEGACY_PATTERN },
  );
  return Number(rows[0]?.count ?? 0);
}

async function migrate() {
  if (!isDbConfigured()) {
    throw new Error('Database is not configured.');
  }

  const counts = {
    users: await countRows('users'),
    userAvatars: await countRows('user_avatars'),
    chatMessages: await countRows('chat_messages'),
  };

  console.log(`${DRY_RUN ? '[dry run] ' : ''}Generated avatar rows`, counts);
  if (DRY_RUN) return;

  await sqlQuery(
    `UPDATE users
     SET avatar_url = '/api/avatars/render?seed=' || replace(selected_avatar_id, '#', '%23')
     WHERE selected_avatar_id IS NOT NULL
       AND avatar_url LIKE :pattern`,
    { pattern: LEGACY_PATTERN },
  );
  await sqlQuery(
    `UPDATE user_avatars
     SET avatar_url = '/api/avatars/render?seed=' || replace(avatar_id, '#', '%23')
     WHERE avatar_url LIKE :pattern`,
    { pattern: LEGACY_PATTERN },
  );
  await sqlQuery(
    `UPDATE chat_messages
     SET avatar_url = '/api/avatars/render?seed=' || substring(avatar_url FROM '[?&]seed=([^&]+)')
     WHERE avatar_url LIKE :pattern
       AND substring(avatar_url FROM '[?&]seed=([^&]+)') IS NOT NULL`,
    { pattern: LEGACY_PATTERN },
  );

  console.log('Three-axis avatar migration complete.');
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Three-axis avatar migration failed:', error);
    process.exit(1);
  });
