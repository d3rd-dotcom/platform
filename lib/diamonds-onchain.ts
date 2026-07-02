import { Contract, providers, utils } from 'ethers';
import { getBlueSigner } from './blue-membership';
import { getPaymasterRpcUrl, getBlueSmartAccount, mintDiamondsSponsored } from './diamonds-paymaster';
import { sqlQuery } from './db';

/**
 * Onchain delivery of Diamonds ($BLUE) rewards.
 *
 * Two delivery paths, per the reward's source:
 * - cdp_mint: course missions/tasks, week seals, and field notes are claim
 *   mints. Preferred transport is a gas-sponsored user operation through CDP
 *   Paymaster (Blue's smart account signs — see diamonds-paymaster.ts), with
 *   a direct owner mint from Blue's key as the fallback so claims never
 *   stall. Users never sign or pay gas either way.
 * - blue_transfer: quest rewards are true p2p transfers from Blue's own 200M
 *   stash, signed by her key. Quest diamonds genuinely come from her.
 *
 * Delivery is fail-soft: the in-app reward always lands first, every attempt
 * is recorded in diamond_onchain_rewards (unique per user+source+ref so a
 * reward can never be delivered twice), and chain errors never bubble up to
 * the reward route.
 */

export type RewardSource = 'course_task' | 'course_seal' | 'field_note' | 'quest';
export type DeliveryMethod = 'cdp_mint' | 'blue_transfer';

const DIAMONDS_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'function minters(address) view returns (bool)',
  'function setMinter(address minter, bool allowed)',
  'function balanceOf(address) view returns (uint256)',
];

export function getDiamondsTokenAddress(): string | null {
  return process.env.DIAMONDS_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS || null;
}

/**
 * ethers v5 defaults EIP-1559 transactions to a 1.5 gwei priority tip —
 * roughly 200x what Base clears at — which drains Blue's gas wallet in a
 * handful of payouts. Price every write from the live base fee instead.
 */
async function baseFeeOverrides(provider: providers.Provider) {
  const block = await provider.getBlock('latest');
  const priority = utils.parseUnits('0.001', 'gwei');
  const baseFee = block.baseFeePerGas ?? utils.parseUnits('0.05', 'gwei');
  return {
    maxPriorityFeePerGas: priority,
    maxFeePerGas: baseFee.mul(2).add(priority),
  };
}

// ── Ledger ──

let schemaEnsured = false;
async function ensureLedgerSchema() {
  if (schemaEnsured) return;
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS diamond_onchain_rewards (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR(36) NOT NULL,
      wallet_address VARCHAR(64) NOT NULL,
      source VARCHAR(24) NOT NULL,
      ref_id VARCHAR(80) NOT NULL,
      amount INTEGER NOT NULL,
      delivery VARCHAR(16) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'pending',
      tx_hash VARCHAR(80) NULL,
      error TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (user_id, source, ref_id)
    )
  `);
  schemaEnsured = true;
}

// ── Claim mints ──

/**
 * The minting address must be authorized on the token. Blue's key is the
 * token owner, so she grants it once, on demand — no manual setup step.
 */
const grantedMinters = new Set<string>();
async function ensureMinter(tokenAddress: string, minterAddress: string) {
  const cacheKey = `${tokenAddress}:${minterAddress}`.toLowerCase();
  if (grantedMinters.has(cacheKey)) return;
  const signer = getBlueSigner();
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, signer);
  const isMinter: boolean = await contract.minters(minterAddress);
  if (!isMinter) {
    const tx = await contract.setMinter(minterAddress, true, await baseFeeOverrides(signer.provider));
    await tx.wait();
    console.log(`[diamonds] Granted minter to ${minterAddress}`);
  }
  grantedMinters.add(cacheKey);
}

/**
 * Mint a claim reward. Prefers a gas-sponsored user operation through CDP
 * Paymaster (burns the sponsorship credits, costs no ETH); falls back to a
 * direct owner mint signed by Blue's key so claims never stall on paymaster
 * config or outages.
 */
async function mintDiamonds(tokenAddress: string, to: string, wholeDiamonds: number): Promise<string> {
  const amountWei = utils.parseUnits(String(wholeDiamonds), 18);

  if (getPaymasterRpcUrl()) {
    try {
      const { account } = await getBlueSmartAccount();
      await ensureMinter(tokenAddress, account.address);
      const { txHash } = await mintDiamondsSponsored(tokenAddress, to, BigInt(amountWei.toString()));
      return txHash;
    } catch (err: any) {
      console.error('[diamonds] Sponsored mint failed, falling back to owner mint:', err?.message ?? err);
    }
  }

  const signer = getBlueSigner();
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, signer);
  const tx = await contract.mint(to, amountWei, await baseFeeOverrides(signer.provider));
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

// ── Blue p2p transfer (quests) ──

async function transferFromBlue(tokenAddress: string, to: string, wholeDiamonds: number): Promise<string> {
  const signer = getBlueSigner();
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, signer);
  const tx = await contract.transfer(
    to,
    utils.parseUnits(String(wholeDiamonds), 18),
    await baseFeeOverrides(signer.provider),
  );
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

// ── Delivery ──

export interface DeliverInput {
  userId: string;
  walletAddress: string | null | undefined;
  source: RewardSource;
  refId: string;
  amount: number;
  delivery: DeliveryMethod;
}

export interface DeliverResult {
  delivered: boolean;
  duplicate?: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Record and attempt onchain delivery of a diamond reward. Never throws —
 * the in-app reward must not depend on the chain being reachable.
 */
export async function deliverDiamondsOnchain(input: DeliverInput): Promise<DeliverResult> {
  try {
    await ensureLedgerSchema();

    if (!input.walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(input.walletAddress)) {
      return { delivered: false, error: 'No valid wallet address for user.' };
    }
    if (!(input.amount > 0)) {
      return { delivered: false, error: 'Invalid amount.' };
    }

    // Reserve the reward — unique per (user, source, ref). A second call for
    // the same reward is a no-op.
    const reserved = await sqlQuery<Array<{ id: string }>>(
      `INSERT INTO diamond_onchain_rewards (user_id, wallet_address, source, ref_id, amount, delivery)
       VALUES (:userId, :walletAddress, :source, :refId, :amount, :delivery)
       ON CONFLICT (user_id, source, ref_id) DO NOTHING
       RETURNING id`,
      {
        userId: input.userId,
        walletAddress: input.walletAddress,
        source: input.source,
        refId: input.refId,
        amount: Math.round(input.amount),
        delivery: input.delivery,
      },
    );
    if (reserved.length === 0) {
      return { delivered: false, duplicate: true };
    }
    const rowId = reserved[0].id;

    const tokenAddress = getDiamondsTokenAddress();
    if (!tokenAddress) {
      await sqlQuery(
        `UPDATE diamond_onchain_rewards SET error = :error, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
        { id: rowId, error: 'DIAMONDS_TOKEN_ADDRESS not configured — left pending for backfill.' },
      );
      return { delivered: false, error: 'Token not configured.' };
    }

    try {
      const txHash = input.delivery === 'blue_transfer'
        ? await transferFromBlue(tokenAddress, input.walletAddress, input.amount)
        : await mintDiamonds(tokenAddress, input.walletAddress, input.amount);

      await sqlQuery(
        `UPDATE diamond_onchain_rewards
         SET status = 'sent', tx_hash = :txHash, error = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        { id: rowId, txHash },
      );
      return { delivered: true, txHash };
    } catch (err: any) {
      const message = err?.message ?? 'Unknown chain error';
      console.error(`[diamonds] Delivery failed for ${input.source}/${input.refId}:`, message);
      await sqlQuery(
        `UPDATE diamond_onchain_rewards
         SET status = 'failed', error = :error, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        { id: rowId, error: String(message).slice(0, 500) },
      );
      return { delivered: false, error: message };
    }
  } catch (outer: any) {
    console.error('[diamonds] Delivery bookkeeping failed:', outer?.message ?? outer);
    return { delivered: false, error: outer?.message ?? 'Ledger error' };
  }
}
