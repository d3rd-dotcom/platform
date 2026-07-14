import { createPublicClient, http, parseUnits, parseEventLogs, parseAbi, type Chain, type TransactionReceipt } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { sqlQuery } from './db';
import { getDiamondsTokenAddress } from './diamonds-onchain';
import { getChainConfig, resolveVerifiedRpcUrl, BURN_ADDRESS } from './chain-config';

/**
 * Diamond ($BLUE) spending — real burns, server-verified.
 *
 * Every spend is a Transfer of $BLUE from the user's own wallet to the dead
 * address, signed by the user. The server verifies the transfer onchain and
 * records it in the diamond_burns ledger; the UNIQUE tx_hash means one burn
 * buys exactly one thing. Callers that can fail after verification (e.g. the
 * chat AI call) should reserve the burn first with recordDiamondBurn and
 * release it with releaseDiamondBurn on failure, so the user's burn is never
 * consumed by a turn that produced nothing.
 *
 * Built on viem: ethers v5's node HTTP transport fails inside deployed Vercel
 * lambdas ("missing response" on every RPC host), which made verification
 * throw on every spend in production.
 */

export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const ERC20_EVENTS_ABI = parseAbi([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

async function getBurnClient() {
  const cfg = getChainConfig();
  const chain: Chain = cfg.chainId === 84532 ? baseSepolia : base;
  return createPublicClient({
    chain,
    transport: http(await resolveVerifiedRpcUrl()),
  });
}

/**
 * Verify the supplied tx is a confirmed $BLUE Transfer of at least
 * `minWholeDiamonds` from `from` to `to`, emitted by the Diamonds token
 * contract, and signed by `from`. Waits briefly for the tx to confirm
 * (spends are signed moments before they are submitted here). Fail closed
 * on any mismatch.
 */
export async function verifyDiamondsTransferTx(
  txHash: string,
  from: string,
  to: string,
  minWholeDiamonds: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tokenAddress = getDiamondsTokenAddress();
  if (!tokenAddress) return { ok: false, reason: 'token_not_configured' };

  const client = await getBurnClient();
  const hash = txHash as `0x${string}`;
  let receipt: TransactionReceipt | null = await client
    .waitForTransactionReceipt({ hash, confirmations: 1, timeout: 30_000 })
    .catch(() => null);
  if (!receipt) {
    receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
  }
  if (!receipt) return { ok: false, reason: 'tx_not_found' };
  if (receipt.status !== 'success') return { ok: false, reason: 'tx_failed' };
  if (receipt.from.toLowerCase() !== from.toLowerCase()) return { ok: false, reason: 'wrong_sender' };

  const requiredAmount = parseUnits(String(minWholeDiamonds), 18);
  const transfers = parseEventLogs({
    abi: ERC20_EVENTS_ABI,
    eventName: 'Transfer',
    logs: receipt.logs,
    strict: false,
  });

  for (const log of transfers) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    const args = log.args as { from?: string; to?: string; value?: bigint };
    if (!args.from || !args.to || typeof args.value !== 'bigint') continue;
    if (args.from.toLowerCase() !== from.toLowerCase()) continue;
    if (args.to.toLowerCase() !== to.toLowerCase()) continue;
    if (args.value < requiredAmount) continue;
    return { ok: true };
  }

  return { ok: false, reason: 'no_transfer' };
}

/** A burn is a verified transfer to the dead address. */
export async function verifyDiamondBurnTx(
  txHash: string,
  userWallet: string,
  minWholeDiamonds: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  return verifyDiamondsTransferTx(txHash, userWallet, BURN_ADDRESS, minWholeDiamonds);
}

let burnSchemaEnsured = false;
export async function ensureBurnLedgerSchema() {
  if (burnSchemaEnsured) return;
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS diamond_burns (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR(36) NOT NULL,
      wallet_address VARCHAR(64) NOT NULL,
      purpose VARCHAR(32) NOT NULL,
      amount INTEGER NOT NULL,
      tx_hash VARCHAR(80) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  burnSchemaEnsured = true;
}

export interface BurnRecordInput {
  userId: string;
  walletAddress: string;
  purpose: string;
  amount: number;
  txHash: string;
}

/**
 * Claim a verified burn for `purpose`. Returns false when the tx hash has
 * already been spent (the UNIQUE constraint rejects replays).
 */
export async function recordDiamondBurn(input: BurnRecordInput): Promise<boolean> {
  await ensureBurnLedgerSchema();
  try {
    await sqlQuery(
      `INSERT INTO diamond_burns (user_id, wallet_address, purpose, amount, tx_hash)
       VALUES (:userId, :walletAddress, :purpose, :amount, :txHash)`,
      {
        userId: input.userId,
        walletAddress: input.walletAddress,
        purpose: input.purpose,
        amount: input.amount,
        txHash: input.txHash.toLowerCase(),
      },
    );
    return true;
  } catch (err: any) {
    if (err?.code === '23505') return false;
    throw err;
  }
}

/**
 * Release a reserved burn so the same tx can be retried — only for spends
 * where the paid-for action failed after the burn was claimed.
 */
export async function releaseDiamondBurn(txHash: string, userId: string): Promise<void> {
  await sqlQuery(
    `DELETE FROM diamond_burns WHERE tx_hash = :txHash AND user_id = :userId`,
    { txHash: txHash.toLowerCase(), userId },
  );
}
