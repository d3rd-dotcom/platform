import {
  createPublicClient,
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
    usdc: TreasuryMetric;
    credits: TreasuryMetric;
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
  const cbBtcAddress = cfg.cbBTcAddress && isAddress(cfg.cbBTcAddress)
    ? cfg.cbBTcAddress as Address
    : null;
  const usdcAddress = isAddress(cfg.usdcAddress) ? cfg.usdcAddress as Address : null;
  const creditsAddress = isAddress(cfg.diamondsTokenAddress)
    ? cfg.diamondsTokenAddress as Address
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
      usdc: { amount: null, symbol: 'USDC' },
      credits: { amount: null, symbol: 'BLUE' },
    },
    updatedAt: new Date().toISOString(),
  };

  if (!treasuryAddress || !cbBtcAddress || !usdcAddress || !creditsAddress) return emptySnapshot;

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
      address: usdcAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    }),
    client.readContract({
      address: creditsAddress,
      abi: ERC20_BALANCE_ABI,
      functionName: 'balanceOf',
      args: [treasuryAddress],
    }),
  ]);

  const cbBtcBalance = fulfilledValue(reads[0]);
  const usdcBalance = fulfilledValue(reads[1]);
  const creditsBalance = fulfilledValue(reads[2]);
  const walletReadCount = [cbBtcBalance, usdcBalance, creditsBalance]
    .filter((value) => value !== null)
    .length;

  return {
    ...emptySnapshot,
    status: walletReadCount === 3 ? 'live' : walletReadCount > 0 ? 'partial' : 'unavailable',
    balances: {
      cbBtc: {
        amount: cbBtcBalance === null ? null : formatUnits(cbBtcBalance, 8),
        symbol: 'cbBTC',
      },
      usdc: {
        amount: usdcBalance === null ? null : formatUnits(usdcBalance, 6),
        symbol: 'USDC',
      },
      credits: {
        amount: creditsBalance === null ? null : formatUnits(creditsBalance, 18),
        symbol: 'BLUE',
      },
    },
  };
}
