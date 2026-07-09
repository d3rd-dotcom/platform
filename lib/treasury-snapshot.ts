import {
  createPublicClient,
  formatEther,
  formatUnits,
  http,
  isAddress,
  type Address,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
import { getChainConfig, resolveVerifiedRpcUrl } from '@/lib/chain-config';

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const VAULT_STATS_ABI = [
  {
    type: 'function',
    name: 'totalDistributed',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'holderCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalShares',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export interface TreasuryMetric {
  amount: string | null;
  symbol: string;
}

export interface TreasurySnapshot {
  status: 'live' | 'partial' | 'unavailable';
  chain: {
    id: number;
    name: string;
    explorerUrl: string;
  };
  wallet: {
    address: string | null;
    explorerUrl: string | null;
  };
  balances: {
    cbBtc: TreasuryMetric;
    credits: TreasuryMetric;
    usdc: TreasuryMetric;
    eth: TreasuryMetric;
  };
  vault: {
    address: string | null;
    explorerUrl: string | null;
    cbBtcBalance: string | null;
    totalDistributed: string | null;
    eligibleHolders: number | null;
    eligibleCredits: string | null;
  };
  updatedAt: string;
}

function resolveBlueTreasuryAddress(): Address | null {
  const configuredAddress =
    process.env.BLUE_AGENT_ADDRESS ||
    process.env.NEXT_PUBLIC_BLUE_AGENT_ADDRESS ||
    process.env.BLUE_TREASURY_ADDRESS;

  if (configuredAddress && isAddress(configuredAddress)) {
    return configuredAddress;
  }

  const rawKey = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!rawKey) return null;

  try {
    const privateKey = (rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`) as `0x${string}`;
    return privateKeyToAccount(privateKey).address;
  } catch {
    return null;
  }
}

function fulfilledValue<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === 'fulfilled' ? result.value : null;
}

export async function fetchTreasurySnapshot(): Promise<TreasurySnapshot> {
  const cfg = getChainConfig();
  const treasuryAddress = resolveBlueTreasuryAddress();
  const vaultAddress = cfg.reflectionVaultAddress && isAddress(cfg.reflectionVaultAddress)
    ? cfg.reflectionVaultAddress as Address
    : null;
  const cbBtcAddress = cfg.cbBTcAddress && isAddress(cfg.cbBTcAddress)
    ? cfg.cbBTcAddress as Address
    : null;

  const emptySnapshot: TreasurySnapshot = {
    status: 'unavailable',
    chain: {
      id: cfg.chainId,
      name: cfg.chainName,
      explorerUrl: cfg.explorerUrl,
    },
    wallet: {
      address: treasuryAddress,
      explorerUrl: treasuryAddress ? `${cfg.explorerUrl}/address/${treasuryAddress}` : null,
    },
    balances: {
      cbBtc: { amount: null, symbol: 'cbBTC' },
      credits: { amount: null, symbol: 'BLUE' },
      usdc: { amount: null, symbol: 'USDC' },
      eth: { amount: null, symbol: 'ETH' },
    },
    vault: {
      address: vaultAddress,
      explorerUrl: vaultAddress ? `${cfg.explorerUrl}/address/${vaultAddress}` : null,
      cbBtcBalance: null,
      totalDistributed: null,
      eligibleHolders: null,
      eligibleCredits: null,
    },
    updatedAt: new Date().toISOString(),
  };

  if (!treasuryAddress || !cbBtcAddress) return emptySnapshot;

  const rpcUrl = await resolveVerifiedRpcUrl();
  const chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
  const client = createPublicClient({ chain, transport: http(rpcUrl) });

  const reads = await Promise.allSettled([
    client.readContract({
      address: cbBtcAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    }),
    client.readContract({
      address: cfg.diamondsTokenAddress as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    }),
    client.readContract({
      address: cfg.usdcAddress as Address,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    }),
    client.getBalance({ address: treasuryAddress }),
    vaultAddress
      ? client.readContract({
          address: cbBtcAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: 'balanceOf',
          args: [vaultAddress],
        })
      : Promise.resolve(null),
    vaultAddress
      ? client.readContract({
          address: vaultAddress,
          abi: VAULT_STATS_ABI,
          functionName: 'totalDistributed',
        })
      : Promise.resolve(null),
    vaultAddress
      ? client.readContract({
          address: vaultAddress,
          abi: VAULT_STATS_ABI,
          functionName: 'holderCount',
        })
      : Promise.resolve(null),
    vaultAddress
      ? client.readContract({
          address: vaultAddress,
          abi: VAULT_STATS_ABI,
          functionName: 'totalShares',
        })
      : Promise.resolve(null),
  ]);

  const cbBtcBalance = fulfilledValue(reads[0]);
  const creditsBalance = fulfilledValue(reads[1]);
  const usdcBalance = fulfilledValue(reads[2]);
  const ethBalance = fulfilledValue(reads[3]);
  const vaultBalance = fulfilledValue(reads[4]);
  const totalDistributed = fulfilledValue(reads[5]);
  const holderCount = fulfilledValue(reads[6]);
  const totalShares = fulfilledValue(reads[7]);
  const walletReadCount = [cbBtcBalance, creditsBalance, usdcBalance, ethBalance]
    .filter((value) => value !== null)
    .length;

  return {
    ...emptySnapshot,
    status: walletReadCount === 4 ? 'live' : walletReadCount > 0 ? 'partial' : 'unavailable',
    balances: {
      cbBtc: {
        amount: cbBtcBalance === null ? null : formatUnits(cbBtcBalance, 8),
        symbol: 'cbBTC',
      },
      credits: {
        amount: creditsBalance === null ? null : formatUnits(creditsBalance, 18),
        symbol: 'BLUE',
      },
      usdc: {
        amount: usdcBalance === null ? null : formatUnits(usdcBalance, 6),
        symbol: 'USDC',
      },
      eth: {
        amount: ethBalance === null ? null : formatEther(ethBalance),
        symbol: 'ETH',
      },
    },
    vault: {
      ...emptySnapshot.vault,
      cbBtcBalance: vaultBalance === null ? null : formatUnits(vaultBalance, 8),
      totalDistributed: totalDistributed === null ? null : formatUnits(totalDistributed, 8),
      eligibleHolders: holderCount === null ? null : Number(holderCount),
      eligibleCredits: totalShares === null ? null : formatUnits(totalShares, 18),
    },
  };
}
