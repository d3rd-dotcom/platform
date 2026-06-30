/**
 * Wipes every user's current avatar and re-rolls it to the DiceBear
 * "shape-grid" set, selecting option #0 as their avatar on a fresh generation.
 * This replaces the old toon-head SVG data URIs with shape-grid HTTP URLs.
 *
 * After this runs, each user has:
 *   - avatar_reroll_count += 1   (fresh generation of 6 options)
 *   - selected_avatar_id = "<userId>#r<N>#0"  (their first shape-grid option)
 *   - avatar_url         = the shape-grid DiceBear HTTP URL
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

  // Fetch current reroll counts so we can bump each user to the next generation.
  const rows = await sqlQuery<Array<{ id: string; username: string | null; avatar_reroll_count: number }>>(
    `SELECT id, username, avatar_reroll_count FROM users`,
    {}
  );

  console.log(
    `${DRY_RUN ? '[DRY RUN] ' : ''}Migrating ${rows.length} user(s) to shape-grid avatars (generation+1).`
  );

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      const nextGen = (row.avatar_reroll_count ?? 0) + 1;
      // Option #0 of the user's next-generation 6-roll.
      const first = getAssignedAvatars(row.id, nextGen)[0];

      if (DRY_RUN) {
        updated++;
        continue;
      }

      await sqlQuery(
        `UPDATE users
            SET avatar_url = :avatarUrl,
                selected_avatar_id = :avatarId,
                avatar_reroll_count = :nextGen
          WHERE id = :userId`,
        { avatarUrl: first.image_url, avatarId: first.id, nextGen, userId: row.id }
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
    console.error('Shape-grid avatar migration failed:', err);
    process.exit(1);
  });
