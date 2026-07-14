/**
 * Re-deliver every FAILED row in diamond_onchain_rewards, all sources —
 * unlike backfill-diamonds.ts (quest-only), this replays course tasks, field
 * notes, welcome grants, guides, and surveys from the ledger's own data.
 *
 * Safe to re-run: each row is deleted and immediately re-reserved by
 * deliverDiamondsOnchain (unique per user+source+ref), so a crash mid-run
 * leaves every reward either still-failed, capped, or sent — never lost.
 * The recorded failures all died before broadcast (eth_getTransactionCount),
 * so nothing here double-pays; the wallet's balance is ground truth if in doubt.
 *
 * Usage:
 *   npx tsx scripts/backfill-failed-rewards.ts --dry-run
 *   npx tsx scripts/backfill-failed-rewards.ts
 */
import path from 'path';
import { config } from 'dotenv';
config({ path: path.join(__dirname, '..', '.env.local') });

import { sqlQuery } from '../lib/db';
import { deliverDiamondsOnchain, type RewardSource, type DeliveryMethod } from '../lib/diamonds-onchain';

interface FailedRow {
  id: string;
  user_id: string;
  wallet_address: string;
  source: RewardSource;
  ref_id: string;
  amount: number;
  delivery: DeliveryMethod;
  error: string | null;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const failed = await sqlQuery<FailedRow[]>(
    `SELECT id, user_id, wallet_address, source, ref_id, amount, delivery, error
     FROM diamond_onchain_rewards
     WHERE status = 'failed'
     ORDER BY created_at ASC`,
    {},
  );

  const total = failed.reduce((sum, r) => sum + r.amount, 0);
  console.log(`${failed.length} failed reward(s), ${total} $BLUE total.`);
  if (dryRun) {
    for (const row of failed) {
      console.log(`  ${row.source}/${row.ref_id}  ${row.amount} -> ${row.wallet_address}  (${(row.error ?? '').slice(0, 60)})`);
    }
    return;
  }

  let sent = 0;
  let stillFailed = 0;
  let capped = 0;
  for (const row of failed) {
    // Delete then immediately re-reserve; deliverDiamondsOnchain re-creates
    // the row and attempts the send.
    await sqlQuery(`DELETE FROM diamond_onchain_rewards WHERE id = :id AND status = 'failed'`, { id: row.id });
    const result = await deliverDiamondsOnchain({
      userId: row.user_id,
      walletAddress: row.wallet_address,
      source: row.source,
      refId: row.ref_id,
      amount: row.amount,
      delivery: row.delivery,
    });
    if (result.delivered) {
      sent += 1;
      console.log(`sent    ${row.source}/${row.ref_id}  +${row.amount}  ${result.txHash}`);
    } else if ((result.error ?? '').includes('cap')) {
      capped += 1;
      console.log(`capped  ${row.source}/${row.ref_id}  +${row.amount}`);
    } else {
      stillFailed += 1;
      console.log(`failed  ${row.source}/${row.ref_id}  +${row.amount}  ${result.error}`);
    }
  }
  console.log(`Done: ${sent} sent, ${capped} capped (release via backfill-diamonds.ts --include-capped), ${stillFailed} still failed.`);
}

main().catch((e) => { console.error('FATAL:', e?.message ?? e); process.exit(1); });
