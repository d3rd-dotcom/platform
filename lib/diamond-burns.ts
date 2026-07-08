import { providers, utils } from 'ethers';
import { sqlQuery } from './db';
import { getDiamondsTokenAddress } from './diamonds-onchain';
import { getChainConfig, BURN_ADDRESS } from './chain-config';

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
 */

export const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const ERC20_INTERFACE = new utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function getBurnProvider(): providers.JsonRpcProvider {
  const cfg = getChainConfig();
  const rpcUrl = cfg.chainId === 8453
    ? process.env.BASE_RPC_URL || cfg.rpcUrl
    : cfg.rpcUrl;
  return new providers.JsonRpcProvider(rpcUrl);
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

  const provider = getBurnProvider();
  const receipt = await provider
    .waitForTransaction(txHash, 1, 30_000)
    .catch(() => provider.getTransactionReceipt(txHash));
  if (!receipt) return { ok: false, reason: 'tx_not_found' };
  if (receipt.status !== 1) return { ok: false, reason: 'tx_failed' };
  if (receipt.from.toLowerCase() !== from.toLowerCase()) return { ok: false, reason: 'wrong_sender' };

  const requiredAmount = utils.parseUnits(String(minWholeDiamonds), 18);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    let parsed;
    try {
      parsed = ERC20_INTERFACE.parseLog(log);
    } catch {
      continue;
    }
    if (parsed.name !== 'Transfer') continue;
    if (String(parsed.args.from).toLowerCase() !== from.toLowerCase()) continue;
    if (String(parsed.args.to).toLowerCase() !== to.toLowerCase()) continue;
    if (parsed.args.value.lt(requiredAmount)) continue;
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
