export type TreasurySwapAsset = 'bitcoin' | 'diamonds' | 'eth';

export interface TreasurySwapQuoteRequest {
  fromAsset: TreasurySwapAsset;
  toAsset: TreasurySwapAsset;
  amount: string;
  taker: string;
}

export interface SerializedTokenFee {
  amount: string;
  token: string;
}

export interface SerializedSwapQuote {
  liquidityAvailable: true;
  fromAsset: TreasurySwapAsset;
  toAsset: TreasurySwapAsset;
  fromAmount: string;
  toAmount: string;
  minToAmount: string;
  fromDecimals: number;
  toDecimals: number;
  fees: {
    gasFee?: SerializedTokenFee;
    protocolFee?: SerializedTokenFee;
  };
  issues: {
    allowance?: {
      currentAllowance: string;
      spender: string;
    };
    balance?: {
      token: string;
      currentBalance: string;
      requiredBalance: string;
    };
    simulationIncomplete: boolean;
  };
  permit2?: {
    eip712: {
      domain: Record<string, unknown>;
      types: Record<string, unknown>;
      primaryType: string;
      message: Record<string, unknown>;
    };
  };
  transaction: {
    to: string;
    data: `0x${string}`;
    value: string;
    gas: string;
    gasPrice: string;
  };
  quotedAt: string;
}

export interface UnavailableSwapQuote {
  liquidityAvailable: false;
  fromAsset: TreasurySwapAsset;
  toAsset: TreasurySwapAsset;
}

export type TreasurySwapQuote = SerializedSwapQuote | UnavailableSwapQuote;
