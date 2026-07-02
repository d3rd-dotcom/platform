import { createPublicClient, encodeFunctionData, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createBundlerClient,
  toCoinbaseSmartAccount,
  type SmartAccount,
  type BundlerClient,
} from 'viem/account-abstraction';

/**
 * Gas-sponsored Diamonds minting through CDP Paymaster & Bundler.
 *
 * Blue's key owns a Coinbase Smart Account; claim mints are sent as user
 * operations through the CDP Paymaster RPC, so gas is covered by the CDP
 * sponsorship credits instead of anyone's ETH. The smart account is
 * counterfactual — its first sponsored operation deploys it.
 *
 * Setup (CDP portal, one time):
 * 1. Paymaster & Bundler → Base Mainnet → copy the RPC URL into
 *    CDP_PAYMASTER_RPC_URL (Vercel + .env.local).
 * 2. In the paymaster policy, allowlist the Diamonds token contract
 *    (DIAMONDS_TOKEN_ADDRESS) and its mint function.
 */

const MINT_ABI = [
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
] as const;

export function getPaymasterRpcUrl(): string | null {
  return process.env.CDP_PAYMASTER_RPC_URL || null;
}

function getBluePrivateKeyHex(): `0x${string}` {
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    throw new Error('BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set.');
  }
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

function getBaseRpcUrl(): string {
  return (
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://mainnet.base.org'
  );
}

let cached: { account: SmartAccount; bundlerClient: BundlerClient } | null = null;

/** Blue's smart account + a bundler client pointed at the CDP Paymaster RPC. */
export async function getBlueSmartAccount(): Promise<{ account: SmartAccount; bundlerClient: BundlerClient }> {
  if (cached) return cached;

  const paymasterUrl = getPaymasterRpcUrl();
  if (!paymasterUrl) {
    throw new Error('CDP_PAYMASTER_RPC_URL not configured.');
  }

  const owner = privateKeyToAccount(getBluePrivateKeyHex());
  const client = createPublicClient({ chain: base, transport: http(getBaseRpcUrl()) });
  const account = await toCoinbaseSmartAccount({ client, owners: [owner], version: '1.1' });
  const bundlerClient = createBundlerClient({
    account,
    client,
    transport: http(paymasterUrl),
    paymaster: true,
  });

  cached = { account, bundlerClient };
  return cached;
}

/**
 * Mint diamonds through a sponsored user operation. Returns the settled
 * transaction hash. Throws on any failure — the caller decides the fallback.
 */
export async function mintDiamondsSponsored(
  tokenAddress: string,
  to: string,
  amountWei: bigint,
): Promise<{ txHash: string; smartAccountAddress: string }> {
  const { account, bundlerClient } = await getBlueSmartAccount();

  const hash = await bundlerClient.sendUserOperation({
    calls: [
      {
        to: tokenAddress as `0x${string}`,
        data: encodeFunctionData({
          abi: MINT_ABI,
          functionName: 'mint',
          args: [to as `0x${string}`, amountWei],
        }),
      },
    ],
  });

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
  if (!receipt.success) {
    throw new Error('Sponsored mint user operation reverted.');
  }
  return { txHash: receipt.receipt.transactionHash, smartAccountAddress: account.address };
}
