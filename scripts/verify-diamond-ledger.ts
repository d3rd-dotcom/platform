/**
 * Prove every diamond interaction actually happened onchain.
 *
 * Cross-checks the two server ledgers against the active chain
 * (chain-config decides mainnet vs Sepolia):
 *
 *   diamond_onchain_rewards (earning) — every 'sent' row must have a real
 *     Transfer of the right amount to the right wallet in its tx receipt.
 *     Catches the silent failure class where a tx "succeeds" on the wrong
 *     chain against a codeless address and moves nothing. Also reports
 *     pending / failed / capped rows — diamonds owed but not yet onchain.
 *
 *   diamond_burns (spending) — every row must have a real Transfer from the
 *     user's wallet to the dead address in its tx receipt.
 *
 * Run:
 *   npx tsx --env-file=.env.local scripts/verify-diamond-ledger.ts
 *   npx tsx --env-file=.env.local scripts/verify-diamond-ledger.ts --limit=200
 *
 * Read-only: needs DATABASE_URL and an RPC; touches nothing.
 */
import { providers, utils } from 'ethers';
import { sqlQuery } from '../lib/db';
import { getChainConfig } from '../lib/chain-config';

const TRANSFER_TOPIC = utils.id('Transfer(address,address,uint256)');
const DEAD = '0x000000000000000000000000000000000000dead';

interface RewardRow {
  id: string; user_id: string; wallet_address: string; source: string;
  ref_id: string; amount: number; delivery: string; status: string;
  tx_hash: string | null; error: string | null;
}
interface BurnRow {
  id: string | number; wallet_address: string; purpose: string;
  amount: number; tx_hash: string;
}

function topicAddr(topic: string): string {
  return ('0x' + topic.slice(-40)).toLowerCase();
}

async function main() {
  const limit = Number((process.argv.find(a => a.startsWith('--limit=')) || '').split('=')[1] || 1000);
  const cfg = getChainConfig();
  const token = cfg.diamondsTokenAddress.toLowerCase();
  const provider = new providers.StaticJsonRpcProvider(cfg.rpcUrl, { chainId: cfg.chainId, name: 'base' });
  console.log(`Chain: ${cfg.chainName} (${cfg.chainId})  token: ${token}\n`);

  let bad = 0;

  const verifyTx = async (
    txHash: string, wallet: string, amount: number,
    direction: 'in' | 'burn',
  ): Promise<string | null> => {
    const receipt = await provider.getTransactionReceipt(txHash).catch(() => null);
    if (!receipt) return 'tx not found on this chain';
    if (receipt.status !== 1) return 'tx reverted';
    const required = utils.parseUnits(String(amount), 18);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== token) continue;
      if (log.topics[0] !== TRANSFER_TOPIC || log.topics.length < 3) continue;
      const from = topicAddr(log.topics[1]);
      const to = topicAddr(log.topics[2]);
      const value = utils.defaultAbiCoder.decode(['uint256'], log.data)[0];
      if (direction === 'in' && to === wallet.toLowerCase() && value.gte(required)) return null;
      if (direction === 'burn' && from === wallet.toLowerCase() && to === DEAD && value.gte(required)) return null;
    }
    return 'no matching BLUE Transfer in receipt (wrong chain, wrong token, or no-op tx)';
  };

  // ── Earning ledger ──
  console.log('── diamond_onchain_rewards (earning) ──');
  const rewards = await sqlQuery<RewardRow[]>(
    `SELECT id, user_id, wallet_address, source, ref_id, amount, delivery, status, tx_hash, error
     FROM diamond_onchain_rewards ORDER BY created_at DESC LIMIT :limit`, { limit });
  const byStatus: Record<string, number> = {};
  for (const r of rewards) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  console.log(`rows: ${rewards.length}  ${JSON.stringify(byStatus)}`);

  for (const r of rewards) {
    if (r.status !== 'sent') continue;
    if (!r.tx_hash) { console.log(`  BAD   sent row ${r.id} has no tx_hash`); bad++; continue; }
    const problem = await verifyTx(r.tx_hash, r.wallet_address, r.amount, 'in');
    if (problem) {
      console.log(`  BAD   ${r.source}/${r.ref_id} ${r.amount} BLUE -> ${r.wallet_address}\n        tx ${r.tx_hash}: ${problem}`);
      bad++;
    }
  }
  const owed = rewards.filter(r => r.status !== 'sent');
  if (owed.length) {
    console.log(`  OWED  ${owed.length} row(s) not yet onchain (pending/failed/capped) — release with scripts/backfill-diamonds.ts:`);
    for (const r of owed.slice(0, 10)) {
      console.log(`        ${r.status.padEnd(7)} ${r.source}/${r.ref_id}  ${r.amount} BLUE  ${String(r.error || '').slice(0, 70)}`);
    }
  }

  // ── Burn ledger ──
  console.log('\n── diamond_burns (spending) ──');
  const burnsTableExists = await sqlQuery<Array<{ ok: boolean }>>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'diamond_burns') AS ok`, {});
  if (!burnsTableExists[0]?.ok) {
    console.log('no diamond_burns table yet (no burns recorded)');
  } else {
    const burns = await sqlQuery<BurnRow[]>(
      `SELECT id, wallet_address, purpose, amount, tx_hash FROM diamond_burns ORDER BY created_at DESC LIMIT :limit`, { limit });
    console.log(`rows: ${burns.length}`);
    for (const b of burns) {
      const problem = await verifyTx(b.tx_hash, b.wallet_address, b.amount, 'burn');
      if (problem) {
        console.log(`  BAD   ${b.purpose} ${b.amount} BLUE from ${b.wallet_address}\n        tx ${b.tx_hash}: ${problem}`);
        bad++;
      }
    }
  }

  console.log(bad === 0
    ? '\nLedger and chain agree — every recorded diamond interaction is real.'
    : `\n${bad} ledger row(s) do NOT match the chain — investigate before mainnet.`);
  process.exit(bad === 0 ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(1); });
