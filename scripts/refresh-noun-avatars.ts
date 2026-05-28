/**
 * Re-bakes users.avatar_url for every user with a selected_avatar_id that
 * looks like a Noun (noun_XX_XX_XXX_XXX_XX). Run after changing the MWA
 * tint filter in lib/avatars.ts so the new look propagates to the profile
 * card, leaderboard, and anywhere else that reads avatar_url from the DB.
 *
 * Legacy Academic Angels (angel_NNN) are skipped — they're hosted IPFS
 * images, not generated SVGs.
 *
 * Run with: npx tsx scripts/refresh-noun-avatars.ts
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env.local') });

import { getAvatarByAvatarId } from '../lib/avatars';
import { isDbConfigured, sqlQuery } from '../lib/db';
import { ensureForumSchema } from '../lib/ensureForumSchema';

const NOUN_ID_RE = /^noun_\d{2}_\d{2}_\d{3}_\d{3}_\d{2}$/;

async function refreshNounAvatars() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  await ensureForumSchema();

  const rows = await sqlQuery<Array<{ id: string; username: string | null; selected_avatar_id: string }>>(
    `SELECT id, username, selected_avatar_id
       FROM users
      WHERE selected_avatar_id IS NOT NULL`,
    {}
  );

  console.log(`Found ${rows.length} users with a selected_avatar_id.`);

  let refreshed = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    if (!NOUN_ID_RE.test(row.selected_avatar_id)) {
      skipped++;
      continue;
    }

    try {
      const avatar = await getAvatarByAvatarId(row.selected_avatar_id);
      if (!avatar) {
        console.warn(`  ! ${row.username || row.id}: could not regenerate ${row.selected_avatar_id}`);
        failed++;
        continue;
      }

      await sqlQuery(
        `UPDATE users SET avatar_url = :avatarUrl WHERE id = :userId`,
        { avatarUrl: avatar.image_url, userId: row.id }
      );
      refreshed++;
    } catch (err) {
      console.warn(`  ! ${row.username || row.id}: error refreshing`, err);
      failed++;
    }
  }

  console.log(`\nDone. Refreshed=${refreshed}  Skipped(non-noun)=${skipped}  Failed=${failed}`);
}

refreshNounAvatars()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Failed to refresh noun avatars:', err);
    process.exit(1);
  });
