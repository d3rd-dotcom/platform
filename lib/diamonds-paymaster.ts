import { createPublicClient, encodeFunctionData, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createBundlerClient,
  toCoinbaseSmartAccount,
  type SmartAccount,
  type BundlerClient,
} from 'viem/account-abstraction';
import { getChainConfig } from './chain-config';

/**
 * Gas-sponsored Diamonds minting through Alchemy Gas Manager.
 *
 * Blue's key owns a Coinbase Smart Account; claim mints are sent as user
 * operations through Alchemy's ERC-4337 bundler with the Gas Manager policy
 * applied, so gas is covered by the Alchemy sponsorship credits instead of
 * anyone's ETH. The smart account is counterfactual — its first sponsored
 * operation deploys it.
 *
 * Setup (Alchemy dashboard, one time):
 * 1. Create an Alchemy app (any Base network) → enable Gas Manager.
 * 2. Create a Gas Manager policy at
 *    https://dashboard.alchemy.com/gas-manager, allowlist the Diamonds token
 *    contract address and its mint function. Copy the Policy ID.
 * 3. Set ALCHEMY_API_KEY and ALCHEMY_GAS_POLICY_ID in Vercel + .env.local.
 *    The bundler URL is derived from ALCHEMY_API_KEY + the active chain.
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
  const apiKey = process.env.ALCHEMY_API_KEY;
  const policyId = process.env.ALCHEMY_GAS_POLICY_ID;
  if (!apiKey || !policyId) return null;
  const cfg = getChainConfig();
  const network = cfg.chainId === 84532 ? 'base-sepolia' : 'base-mainnet';
  return `https://${network}.g.alchemy.com/v2/${apiKey}`;
}

function getAlchemyGasPolicyId(): string | null {
  return process.env.ALCHEMY_GAS_POLICY_ID || null;
}

function getBluePrivateKeyHex(): `0x${string}` {
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    throw new Error('BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set.');
  }
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

function getBaseRpcUrl(): string {
  const cfg = getChainConfig();
  return cfg.rpcUrl;
}

let cached: { account: SmartAccount; bundlerClient: BundlerClient } | null = null;

/** Blue's smart account + a bundler client pointed at Alchemy's bundler endpoint. */
export async function getBlueSmartAccount(): Promise<{ account: SmartAccount; bundlerClient: BundlerClient }> {
  if (cached) return cached;

  const paymasterUrl = getPaymasterRpcUrl();
  if (!paymasterUrl) {
    throw new Error('ALCHEMY_API_KEY + ALCHEMY_GAS_POLICY_ID not configured.');
  }

  const cfg = getChainConfig();
  const chain = cfg.chainId === 84532 ? baseSepolia : base;

  const owner = privateKeyToAccount(getBluePrivateKeyHex());
  const client = createPublicClient({ chain, transport: http(getBaseRpcUrl()) });
  const account = await toCoinbaseSmartAccount({ client, owners: [owner], version: '1.1' });
  const bundlerClient = createBundlerClient({
    account,
    client,
    transport: http(paymasterUrl),
    paymaster: true,
    userOperation: {
      estimateFeesPerGas: async () => {
        return {
          maxFeePerGas: 0n,
          maxPriorityFeePerGas: 0n,
        };
      },
    },
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
  const policyId = getAlchemyGasPolicyId();

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
    ...(policyId ? {
      alchemy: {
        gasPolicyId: policyId,
      },
    } : {}),
  });

  const receipt = await bundlerClient.waitForUserOperationReceipt({ hash });
  if (!receipt.success) {
    throw new Error('Sponsored mint user operation reverted.');
  }
  return { txHash: receipt.receipt.transactionHash, smartAccountAddress: account.address };
}
