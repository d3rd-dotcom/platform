import { CdpClient } from '@coinbase/cdp-sdk';
import { isAddress, parseUnits, type Address } from 'viem';
import { getChainConfig } from '@/lib/chain-config';
import type {
  SerializedSwapQuote,
  TreasurySwapAsset,
  TreasurySwapQuote,
} from '@/lib/treasury-swap-types';

const NATIVE_ETH = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' as Address;

interface SwapToken {
  address: Address;
  decimals: number;
}

let cdpClient: CdpClient | null = null;

function getCdpClient(): CdpClient {
  if (cdpClient) return cdpClient;

  const apiKeyId = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;
  if (!apiKeyId || !apiKeySecret) {
    throw Object.assign(new Error('CDP Trade API credentials are not configured.'), {
      status: 503,
      code: 'CDP_SWAP_NOT_CONFIGURED',
    });
  }

  cdpClient = new CdpClient({ apiKeyId, apiKeySecret });
  return cdpClient;
}

function getToken(asset: TreasurySwapAsset): SwapToken {
  const cfg = getChainConfig();
  if (cfg.chainId !== 8453) {
    throw Object.assign(new Error('Swaps are available on Base mainnet.'), {
      status: 409,
      code: 'SWAP_MAINNET_ONLY',
    });
  }

  if (asset === 'eth') return { address: NATIVE_ETH, decimals: 18 };
  if (asset === 'bitcoin') {
    if (!cfg.cbBTcAddress || !isAddress(cfg.cbBTcAddress)) {
      throw Object.assign(new Error('Bitcoin is not configured on Base.'), {
        status: 503,
        code: 'BITCOIN_NOT_CONFIGURED',
      });
    }
    return { address: cfg.cbBTcAddress, decimals: 8 };
  }
  if (!isAddress(cfg.diamondsTokenAddress)) {
    throw Object.assign(new Error('Diamonds are not configured on Base.'), {
      status: 503,
      code: 'DIAMONDS_NOT_CONFIGURED',
    });
  }
  return { address: cfg.diamondsTokenAddress, decimals: 18 };
}

function serializeUnknown(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serializeUnknown);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, serializeUnknown(child)]),
    );
  }
  return value;
}

export async function createTreasurySwapQuote(input: {
  fromAsset: TreasurySwapAsset;
  toAsset: TreasurySwapAsset;
  amount: string;
  taker: Address;
  idempotencyKey: string;
}): Promise<TreasurySwapQuote> {
  if (input.fromAsset === input.toAsset) {
    throw Object.assign(new Error('Choose two different assets.'), {
      status: 400,
      code: 'SAME_SWAP_ASSET',
    });
  }

  const from = getToken(input.fromAsset);
  const to = getToken(input.toAsset);
  let fromAmount: bigint;
  try {
    fromAmount = parseUnits(input.amount, from.decimals);
  } catch {
    throw Object.assign(new Error('Enter a valid swap amount.'), {
      status: 400,
      code: 'INVALID_SWAP_AMOUNT',
    });
  }
  if (fromAmount <= 0n) {
    throw Object.assign(new Error('Swap amount must be greater than zero.'), {
      status: 400,
      code: 'INVALID_SWAP_AMOUNT',
    });
  }

  const result = await getCdpClient().evm.createSwapQuote({
    network: 'base',
    fromToken: from.address,
    toToken: to.address,
    fromAmount,
    taker: input.taker,
    slippageBps: 100,
    idempotencyKey: input.idempotencyKey,
  });

  if (!result.liquidityAvailable || !('transaction' in result) || !result.transaction) {
    return {
      liquidityAvailable: false,
      fromAsset: input.fromAsset,
      toAsset: input.toAsset,
    };
  }

  type SerializedEip712 = NonNullable<SerializedSwapQuote['permit2']>['eip712'];

  return {
    liquidityAvailable: true,
    fromAsset: input.fromAsset,
    toAsset: input.toAsset,
    fromAmount: result.fromAmount.toString(),
    toAmount: result.toAmount.toString(),
    minToAmount: result.minToAmount.toString(),
    fromDecimals: from.decimals,
    toDecimals: to.decimals,
    fees: {
      gasFee: result.fees.gasFee
        ? {
            amount: result.fees.gasFee.amount.toString(),
            token: result.fees.gasFee.token,
          }
        : undefined,
      protocolFee: result.fees.protocolFee
        ? {
            amount: result.fees.protocolFee.amount.toString(),
            token: result.fees.protocolFee.token,
          }
        : undefined,
    },
    issues: {
      allowance: result.issues.allowance
        ? {
            currentAllowance: result.issues.allowance.currentAllowance.toString(),
            spender: result.issues.allowance.spender,
          }
        : undefined,
      balance: result.issues.balance
        ? {
            token: result.issues.balance.token,
            currentBalance: result.issues.balance.currentBalance.toString(),
            requiredBalance: result.issues.balance.requiredBalance.toString(),
          }
        : undefined,
      simulationIncomplete: result.issues.simulationIncomplete,
    },
    permit2: result.permit2
      ? {
          eip712: serializeUnknown(result.permit2.eip712) as SerializedEip712,
        }
      : undefined,
    transaction: {
      to: result.transaction.to,
      data: result.transaction.data,
      value: result.transaction.value.toString(),
      gas: result.transaction.gas.toString(),
      gasPrice: result.transaction.gasPrice.toString(),
    },
    quotedAt: new Date().toISOString(),
  };
}
