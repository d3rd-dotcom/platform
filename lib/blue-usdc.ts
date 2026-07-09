import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { getChainConfig, resolveVerifiedRpcUrl } from './chain-config';

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
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [{ type: 'address' }, { type: 'uint256' }],
    outputs: [{ type: 'bool' }],
  },
] as const;

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
): Promise<{ txHashes: string[]; failed: { address: string; error: string }[] }> {
  const txHashes: string[] = [];
  const failed: { address: string; error: string }[] = [];
  if (recipients.length === 0) return { txHashes, failed };

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
    try {
      if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
        throw new Error(`Invalid recipient address: ${address}`);
      }
      const hash = await wallet.writeContract({
        address: usdc,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [address as `0x${string}`, BigInt(amount)],
        nonce,
      });
      broadcast = true;
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') {
        throw new Error(`USDC transfer reverted (${hash})`);
      }
      txHashes.push(hash);
    } catch (err) {
      failed.push({ address, error: err instanceof Error ? err.message : 'Unknown error' });
    } finally {
      if (broadcast) nonce++;
    }
  }

  return { txHashes, failed };
}
