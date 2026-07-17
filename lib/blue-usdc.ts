import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeFunctionData,
  http,
  keccak256,
} from 'viem';
import type { TransactionSerializable } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, resolveVerifiedRpcUrl } from './chain-config';
import { getPool } from './db';

/**
 * USDC payouts from Blue's wallet, signed with her raw private key
 * (BLUE_PRIVATE_KEY, legacy fallback AZURA_PRIVATE_KEY) via viem — the same
 * signer model as the treasury/reflections pipeline (see
 * app/api/cron/reflections/route.ts). This replaces the Coinbase CDP managed
 * Wallet SDK: payouts now leave the very address that custodies quest escrow
 * (getBlueWalletAddress), so a payout can never fail for lack of funds that
 * were deposited to a different, CDP-managed address.
 *
 * USDC is a standard ERC-20, so a payout is a plain `transfer` from Blue to
 * the recipient — no approval needed. Transfers are sequential with explicit
 * nonce management so a lagging RPC replica cannot hand out a duplicate nonce,
 * and every send waits for its receipt and verifies success before it counts.
 */

const ERC20_ABI = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

export interface UsdcTransferFailure {
  address: string;
  error: string;
  /** The transaction reached the RPC and therefore must never be blindly retried. */
  broadcast: boolean;
  txHash?: string;
  /** A mined revert is the only broadcast outcome that is definitively retry-safe. */
  confirmedFailure: boolean;
}

export function isUsdcPayoutRetrySafe(failure: UsdcTransferFailure): boolean {
  return !failure.broadcast || failure.confirmedFailure;
}

interface DistributeUsdcOptions {
  /** Persist the deterministic signed hash before any broadcast is attempted. */
  onPrepared?: (details: { address: string; txHash: string }) => Promise<void>;
}

const PAYOUT_LOCK_KEY = 'mwa:blue-usdc-payout';

/**
 * Serialize Blue-wallet nonce preparation across requests and app instances.
 * The lock is session-scoped because the prepared hash must commit on a
 * separate connection before the transaction reaches the RPC.
 */
async function withBlueUsdcPayoutLock<T>(callback: () => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  let acquired = false;
  let releaseError: Error | undefined;

  try {
    const result = await client.query<{ acquired: boolean }>(
      `SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired`,
      [PAYOUT_LOCK_KEY],
    );
    acquired = result.rows[0]?.acquired === true;
    if (!acquired) {
      throw new Error('A Blue payout is already in progress. Try again shortly.');
    }
    return await callback();
  } finally {
    if (acquired) {
      try {
        await client.query(
          `SELECT pg_advisory_unlock(hashtextextended($1, 0))`,
          [PAYOUT_LOCK_KEY],
        );
      } catch (error) {
        releaseError = error instanceof Error
          ? error
          : new Error('Failed to release the Blue payout lock.');
      }
    }
    client.release(releaseError);
  }
}

export async function persistUsdcHashBeforeBroadcast<T>(input: {
  persist: () => Promise<void>;
  broadcast: () => Promise<T>;
}): Promise<T> {
  await input.persist();
  return input.broadcast();
}

function getBlueKey(): `0x${string}` {
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set — Blue cannot sign USDC payouts.',
    );
  }
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

/** Blue's payout wallet address, derived from her key (no network call). */
export function getBlueUsdcWalletAddress(): string {
  return privateKeyToAccount(getBlueKey()).address;
}

/**
 * Send USDC from Blue's wallet to one or more recipients on the active chain.
 * `amount` is in USDC base units (6 decimals) as a decimal string — the same
 * shape the old CDP distributeUSDC accepted, so callers are unchanged.
 * Returns per-recipient results so callers can fail-closed on any failure.
 */
export async function distributeUSDC(
  recipients: { address: string; amount: string }[],
  options: DistributeUsdcOptions = {},
): Promise<{ txHashes: string[]; failed: UsdcTransferFailure[] }> {
  if (recipients.length === 0) return { txHashes: [], failed: [] };
  return withBlueUsdcPayoutLock(
    () => distributeUsdcWithLock(recipients, options),
  );
}

async function distributeUsdcWithLock(
  recipients: { address: string; amount: string }[],
  options: DistributeUsdcOptions,
): Promise<{ txHashes: string[]; failed: UsdcTransferFailure[] }> {
  const txHashes: string[] = [];
  const failed: UsdcTransferFailure[] = [];

  const cfg = getChainConfig();
  const rpcUrl = await resolveVerifiedRpcUrl();
  const chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
  const account = privateKeyToAccount(getBlueKey());
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const wallet = createWalletClient({ account, chain, transport: http(rpcUrl) });
  const usdc = cfg.usdcAddress as `0x${string}`;

  // One account, sequential sends: manage the nonce explicitly. Only advance
  // it once a transaction actually broadcast (mined, whether success or
  // revert); a send that never left the client leaves the nonce free for the
  // next recipient rather than opening a gap.
  let nonce = await client.getTransactionCount({ address: account.address, blockTag: 'pending' });

  for (const { address, amount } of recipients) {
    let broadcast = false;
    let confirmedFailure = false;
    let txHash: string | undefined;
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`Invalid recipient address: ${address}`);
      }
      const request = await wallet.prepareTransactionRequest({
        account,
        to: usdc,
        data: encodeFunctionData({
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [address as `0x${string}`, BigInt(amount)],
        }),
        nonce,
      });
      const { account: preparedAccount, chain: preparedChain, from, ...preparedTransaction } = request;
      void preparedAccount;
      void preparedChain;
      void from;
      const serialized = await account.signTransaction(preparedTransaction as TransactionSerializable);
      const hash = keccak256(serialized);
      txHash = hash;
      await persistUsdcHashBeforeBroadcast({
        persist: async () => {
          if (options.onPrepared) await options.onPrepared({ address, txHash: hash });
        },
        broadcast: async () => {
          // A send error can be an ambiguous RPC response after acceptance.
          // Mark the attempt before calling the RPC so it stays reconciliation-only.
          broadcast = true;
          return wallet.sendRawTransaction({ serializedTransaction: serialized });
        },
      });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        confirmedFailure = true;
        throw new Error(`USDC transfer reverted (${hash})`);
      }
      txHashes.push(hash);
    } catch (err) {
      failed.push({
        address,
        error: err instanceof Error ? err.message : 'Unknown error',
        broadcast,
        txHash,
        confirmedFailure,
      });
    } finally {
      if (broadcast) nonce++;
    }
  }

  return { txHashes, failed };
}

export type UsdcTransferVerification =
  | { status: 'confirmed' }
  | { status: 'reverted' }
  | { status: 'pending'; error: string }
  | { status: 'mismatch'; error: string };

/**
 * Reconcile a previously persisted payout hash against Base. A successful
 * receipt is insufficient by itself: the receipt must contain the exact USDC
 * Transfer from Blue to the stored recipient for the stored amount.
 */
export async function verifyUSDCTransfer(input: {
  txHash: string;
  recipient: string;
  amount: string;
}): Promise<UsdcTransferVerification> {
  if (!/^0x[a-fA-F0-9]{64}$/.test(input.txHash)) {
    return { status: 'mismatch', error: 'Stored payout transaction hash is invalid.' };
  }

  const cfg = getChainConfig();
  const rpcUrl = await resolveVerifiedRpcUrl();
  const chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
  const account = privateKeyToAccount(getBlueKey());
  const client = createPublicClient({ chain, transport: http(rpcUrl) });
  const usdc = cfg.usdcAddress.toLowerCase();

  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: input.txHash as `0x${string}` });
  } catch (err) {
    return {
      status: 'pending',
      error: err instanceof Error ? err.message : 'Payout receipt is not available yet.',
    };
  }

  if (receipt.status !== 'success') return { status: 'reverted' };
  if (receipt.to?.toLowerCase() !== usdc) {
    return { status: 'mismatch', error: 'Payout transaction did not call the configured USDC contract.' };
  }

  const expectedRecipient = input.recipient.toLowerCase();
  const expectedSender = account.address.toLowerCase();
  const expectedAmount = BigInt(input.amount);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdc) continue;
    try {
      const decoded = decodeEventLog({ abi: ERC20_ABI, data: log.data, topics: log.topics });
      if (decoded.eventName !== 'Transfer') continue;
      const args = decoded.args as { from: string; to: string; value: bigint };
      if (
        args.from.toLowerCase() === expectedSender
        && args.to.toLowerCase() === expectedRecipient
        && args.value === expectedAmount
      ) {
        return { status: 'confirmed' };
      }
    } catch {
      // Ignore unrelated or malformed logs from the same receipt.
    }
  }

  return { status: 'mismatch', error: 'Payout transaction does not match the stored recipient and amount.' };
}
