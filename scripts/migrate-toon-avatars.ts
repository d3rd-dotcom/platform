/**
 * Wipes every user's current avatar and re-rolls it to the new DiceBear
 * "toon-head" set, selecting option #0 as their avatar. This replaces the old
 * Noun/Angel avatars (and any other stored avatar_url) for all users.
 *
 * After this runs, each user has:
 *   - selected_avatar_id = "<userId>#0"  (their first toon option)
 *   - avatar_url         = the rendered toon SVG data URI
 * They can still open the avatar picker to choose a different one of their 6.
 *
 * Run a preview first:   npx tsx scripts/migrate-toon-avatars.ts --dry-run
 * Then apply for real:   npx tsx scripts/migrate-toon-avatars.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getAssignedAvatars } from '../lib/avatars';
import { isDbConfigured, sqlQuery } from '../lib/db';
import { ensureForumSchema } from '../lib/ensureForumSchema';

const DRY_RUN = process.argv.includes('--dry-run');

async function migrate() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  await ensureForumSchema();

  const rows = await sqlQuery<Array<{ id: string; username: string | null }>>(
    `SELECT id, username FROM users`,
    {}
  );

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}Re-rolling toon avatars for ${rows.length} user(s).`
  );

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      // Option #0 of the user's deterministic 6-roll.
      const first = getAssignedAvatars(row.id)[0];

      if (DRY_RUN) {
        updated++;
        continue;
      }

      await sqlQuery(
        `UPDATE users
            SET avatar_url = :avatarUrl,
                selected_avatar_id = :avatarId
          WHERE id = :userId`,
        { avatarUrl: first.image_url, avatarId: first.id, userId: row.id }
      );
      updated++;
    } catch (err) {
      console.warn(`  ! ${row.username || row.id}: error`, err);
      failed++;
    }
  }

  console.log(
    `\nDone. ${DRY_RUN ? 'Would update' : 'Updated'}=${updated}  Failed=${failed}` +
      (DRY_RUN ? '  (dry run — no writes made)' : '')
  );
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Toon avatar migration failed:', err);
    process.exit(1);
  });
