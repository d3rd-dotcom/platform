import { Contract, providers, utils, Wallet } from 'ethers';
import { getPaymasterRpcUrl, getBlueSmartAccount, mintDiamondsSponsored } from './diamonds-paymaster';
import { sqlQuery } from './db';
import { getDiamondsTokenAddress as getTokenAddress, getChainConfig, resolveVerifiedRpcUrl } from './chain-config';

/**
 * Onchain delivery of Diamonds ($BLUE) rewards.
 *
 * Two delivery paths, per the reward's source:
 * - cdp_mint: course missions/tasks, week seals, and field notes are claim
 *   mints. Preferred transport is a gas-sponsored user operation through
 *   Alchemy Gas Manager (Blue's smart account signs — see
 *   diamonds-paymaster.ts), with a direct owner mint from Blue's key as the
 *   fallback so claims never stall. Users never sign or pay gas either way.
 * - blue_transfer: quest rewards are true p2p transfers from Blue's own 200M
 *   stash, signed by her key. Quest diamonds genuinely come from her.
 *
 * Delivery is fail-soft: the in-app reward always lands first, every attempt
 * is recorded in diamond_onchain_rewards (unique per user+source+ref so a
 * reward can never be delivered twice), and chain errors never bubble up to
 * the reward route.
 */

export type RewardSource =
  | 'course_task'
  | 'course_seal'
  | 'field_note'
  | 'quest'
  | 'guide'
  | 'survey'
  | 'welcome';
export type DeliveryMethod = 'cdp_mint' | 'blue_transfer';

const DIAMONDS_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function mint(address to, uint256 amount)',
  'function minters(address) view returns (bool)',
  'function setMinter(address minter, bool allowed)',
  'function balanceOf(address) view returns (uint256)',
];

export function getDiamondsTokenAddress(): string | null {
  return getTokenAddress();
}

/**
 * Blue's wallet as an ethers signer on the ACTIVE Diamonds chain. Unlike
 * blue-membership's getBlueSigner (mainnet-pinned for VIP card sales), every
 * Diamonds write must follow chain-config, or testnet-mode transfers and
 * mints land on mainnet as codeless-address no-ops that still ledger 'sent'.
 * The RPC is verified against the expected chain id before use — a wrong
 * BASE_SEPOLIA_RPC_URL in prod env has pointed these writes at mainnet.
 */
async function getBlueSigner(): Promise<Wallet> {
  const cfg = getChainConfig();
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    throw new Error('BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set — Blue cannot sign Diamonds rewards.');
  }
  const provider = new providers.StaticJsonRpcProvider(await resolveVerifiedRpcUrl(), {
    chainId: cfg.chainId,
    name: cfg.chainName.toLowerCase().replace(/\s+/g, '-'),
  });
  return new Wallet(key.startsWith('0x') ? key : `0x${key}`, provider);
}

/**
 * Most $BLUE one account can receive onchain per UTC day. Sized so a heavy
 * honest day (field-note seal 700 + daily note 100 + course tasks + quests)
 * clears it, while a completion-farming burst parks as 'capped' instead of
 * draining Blue. Capped rows keep their in-app credits and can be released
 * deliberately with scripts/backfill-diamonds.ts --include-capped.
 */
function getDailyMintCap(): number {
  const cap = Number(process.env.DIAMONDS_DAILY_MINT_CAP || 1500);
  return Number.isFinite(cap) && cap > 0 ? cap : 1500;
}

/**
 * ethers v5 defaults EIP-1559 transactions to a 1.5 gwei priority tip —
 * roughly 200x what Base clears at — which drains Blue's gas wallet in a
 * handful of payouts. Price every write from the live base fee instead.
 *
 * The base-fee read is just that — a read — so it's safe to retry a few
 * times against RPC blips, and safe to fall back to a static estimate if
 * every attempt fails. It must never throw: a flaky read here used to abort
 * the whole reward (see diamond_onchain_rewards rows failed on
 * eth_getBlockByNumber SERVER_ERROR from Alchemy) even though the actual
 * mint/transfer never got a chance to run.
 */
async function baseFeeOverrides(provider: providers.Provider) {
  const priority = utils.parseUnits('0.001', 'gwei');
  const fallbackBaseFee = utils.parseUnits('0.05', 'gwei');
  let baseFee = fallbackBaseFee;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const block = await provider.getBlock('latest');
      baseFee = block.baseFeePerGas ?? fallbackBaseFee;
      break;
    } catch (err: any) {
      if (attempt === 3) {
        console.error('[diamonds] base-fee read failed 3x, using fallback gas price:', err?.message ?? err);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }
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
  const signer = await getBlueSigner();
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
 * Mint a claim reward. Prefers a gas-sponsored user operation through Alchemy
 * Gas Manager (costs no ETH); falls back to a direct owner mint signed by
 * Blue's key so claims never stall on Gas Manager config or outages.
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

  const signer = await getBlueSigner();
  const contract = new Contract(tokenAddress, DIAMONDS_ABI, signer);
  const tx = await contract.mint(to, amountWei, await baseFeeOverrides(signer.provider));
  const receipt = await tx.wait();
  return receipt.transactionHash;
}

// ── Blue p2p transfer (quests) ──

async function transferFromBlue(tokenAddress: string, to: string, wholeDiamonds: number): Promise<string> {
  const signer = await getBlueSigner();
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

    const sentToday = await sqlQuery<Array<{ total: string | null }>>(
      `SELECT SUM(amount)::text AS total FROM diamond_onchain_rewards
       WHERE user_id = :userId AND status = 'sent'
         AND updated_at >= date_trunc('day', CURRENT_TIMESTAMP)`,
      { userId: input.userId },
    );
    if (Number(sentToday[0]?.total ?? 0) + Math.round(input.amount) > getDailyMintCap()) {
      await sqlQuery(
        `UPDATE diamond_onchain_rewards
         SET status = 'capped', error = :error, updated_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        { id: rowId, error: `Daily onchain cap (${getDailyMintCap()}) reached — held for review.` },
      );
      return { delivered: false, error: 'Daily onchain reward cap reached.' };
    }

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
