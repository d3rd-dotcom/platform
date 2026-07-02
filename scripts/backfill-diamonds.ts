/**
 * Backfill onchain $BLUE for quest completions that predate the Diamonds
 * launch (or whose delivery failed). Idempotent: it only touches quest rows
 * with no ledger entry in diamond_onchain_rewards, and delivery itself is
 * unique per (user, source, ref). Safe to re-run until everything is sent.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/backfill-diamonds.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/backfill-diamonds.ts --limit=1
 *   npx tsx --env-file=.env.local scripts/backfill-diamonds.ts
 */
import { sqlQuery } from '../lib/db';
import { deliverDiamondsOnchain } from '../lib/diamonds-onchain';

interface OwedRow {
  user_id: string;
  username: string;
  wallet_address: string;
  quest_id: string;
  shards_awarded: number;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Number.POSITIVE_INFINITY;

  // A 'failed' row means the transfer never happened (status only becomes
  // 'sent' after the receipt). Clear them so delivery can re-reserve; the
  // wallet's onchain balance is the ground truth if in doubt.
  if (!dryRun) {
    const cleared = await sqlQuery<Array<{ id: string }>>(
      `DELETE FROM diamond_onchain_rewards WHERE status = 'failed' RETURNING id`,
      {},
    );
    if (cleared.length > 0) console.log(`Cleared ${cleared.length} failed ledger row(s) for retry.`);
  }

  const owed = await sqlQuery<OwedRow[]>(
    `SELECT q.user_id, u.username, u.wallet_address, q.quest_id, q.shards_awarded
     FROM quests q
     JOIN users u ON u.id = q.user_id
     WHERE q.shards_awarded > 0
       AND u.wallet_address ~ '^0x[a-fA-F0-9]{40}$'
       AND NOT EXISTS (
         SELECT 1 FROM diamond_onchain_rewards d
         WHERE d.user_id = q.user_id AND d.source = 'quest' AND d.ref_id = q.quest_id
       )
     ORDER BY q.completed_at ASC`,
    {},
  );

  const total = owed.reduce((sum, r) => sum + r.shards_awarded, 0);
  console.log(`${owed.length} undelivered quest reward(s), ${total} $BLUE total.`);
  if (dryRun || owed.length === 0) return;

  let sent = 0;
  let failed = 0;
  for (const row of owed.slice(0, limit)) {
    const result = await deliverDiamondsOnchain({
      userId: row.user_id,
      walletAddress: row.wallet_address,
      source: 'quest',
      refId: row.quest_id,
      amount: row.shards_awarded,
      delivery: 'blue_transfer',
    });
    if (result.delivered) {
      sent += 1;
      console.log(`sent  ${row.username}  ${row.quest_id}  +${row.shards_awarded}  ${result.txHash}`);
    } else {
      failed += 1;
      console.log(`FAIL  ${row.username}  ${row.quest_id}  +${row.shards_awarded}  ${result.error ?? 'duplicate'}`);
    }
  }
  console.log(`Done: ${sent} sent, ${failed} failed, ${owed.length - Math.min(owed.length, limit)} remaining.`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
