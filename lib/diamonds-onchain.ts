import { Contract, utils } from 'ethers';
import { Coinbase, Wallet as CdpWallet } from '@coinbase/coinbase-sdk';
import { getBlueSigner } from './blue-membership';
import { sqlQuery } from './db';

/**
 * Onchain delivery of Diamonds ($BLUE) rewards.
 *
 * Two delivery paths, per the reward's source:
 * - cdp_mint: course missions/tasks, week seals, and field notes are claim
 *   mints — Blue's CDP server wallet signs the mint so the user never has to.
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

const MINT_ABI_JSON = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
];

export function getDiamondsTokenAddress(): string | null {
  return process.env.DIAMONDS_TOKEN_ADDRESS || process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS || null;
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

// ── CDP wallet (claim mints) ──

let cdpWallet: CdpWallet | null = null;
async function getCdpWallet(): Promise<CdpWallet> {
  if (cdpWallet) return cdpWallet;

  const apiKeyName = process.env.CDP_API_KEY_NAME;
  const apiKeyPrivateKey = process.env.CDP_API_KEY_PRIVATE_KEY;
  if (!apiKeyName || !apiKeyPrivateKey) {
    throw new Error('CDP credentials not configured (CDP_API_KEY_NAME / CDP_API_KEY_PRIVATE_KEY).');
  }

  const walletId = process.env.BLUE_WALLET_ID || process.env.AZURA_WALLET_ID;
  const walletSeed = process.env.BLUE_WALLET_SEED || process.env.AZURA_WALLET_SEED;
  if (!walletId || !walletSeed) {
    throw new Error('CDP wallet not configured (BLUE_WALLET_ID / BLUE_WALLET_SEED).');
  }

  new Coinbase({ apiKeyName, privateKey: apiKeyPrivateKey });
  cdpWallet = await CdpWallet.import({ walletId, seed: walletSeed });
  return cdpWallet;
}

/**
 * The CDP wallet must be an authorized minter. Blue's key is the token owner,
 * so she grants it once, on demand — no manual setup step.
 */
let minterEnsured = false;
async function ensureCdpMinter(tokenAddress: string, cdpAddress: string) {
  if (minterEnsured) return;
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, getBlueSigner());
  const isMinter: boolean = await contract.minters(cdpAddress);
  if (!isMinter) {
    const tx = await contract.setMinter(cdpAddress, true);
    await tx.wait();
    console.log(`[diamonds] Granted minter to CDP wallet ${cdpAddress}`);
  }
  minterEnsured = true;
}

async function mintViaCdp(tokenAddress: string, to: string, wholeDiamonds: number): Promise<string> {
  const wallet = await getCdpWallet();
  const address = await wallet.getDefaultAddress();
  await ensureCdpMinter(tokenAddress, address.getId());

  const invocation = await address.invokeContract({
    contractAddress: tokenAddress,
    method: 'mint',
    args: {
      to,
      amount: utils.parseUnits(String(wholeDiamonds), 18).toString(),
    },
    abi: MINT_ABI_JSON,
  });
  await invocation.wait();
  const txHash = invocation.getTransactionHash();
  if (!txHash) throw new Error('CDP mint broadcast but no transaction hash returned.');
  return txHash;
}

// ── Blue p2p transfer (quests) ──

async function transferFromBlue(tokenAddress: string, to: string, wholeDiamonds: number): Promise<string> {
  const signer = getBlueSigner();
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, signer);
  const tx = await contract.transfer(to, utils.parseUnits(String(wholeDiamonds), 18));
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
        : await mintViaCdp(tokenAddress, input.walletAddress, input.amount);

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
