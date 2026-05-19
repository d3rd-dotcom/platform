import { BigNumber, Contract, providers, utils } from 'ethers';

/**
 * Crypto checkout for the VIP Membership card.
 *
 * Buyers who would rather not use a card pay Blue's wallet directly in USDC
 * or ETH on Base. This module quotes the price in each currency and verifies
 * an incoming payment transaction on-chain before the NFT is released.
 */

export const BASE_CHAIN_ID = 8453;

/** USDC on Base mainnet. */
export const USDC_ADDRESS = (
  process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
).toLowerCase();
export const USDC_DECIMALS = 6;

/** Chainlink ETH/USD aggregator on Base mainnet. */
const ETH_USD_FEED = process.env.ETH_USD_PRICE_FEED || '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70';

/** ERC-20 Transfer(address,address,uint256) event topic. */
const ERC20_TRANSFER_TOPIC = utils.id('Transfer(address,address,uint256)').toLowerCase();

const AGGREGATOR_ABI = [
  'function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
  'function decimals() view returns (uint8)',
];

function getBaseRpcUrl(): string {
  return (
    process.env.VIP_MEMBERSHIP_CARD_RPC_URL ||
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://mainnet.base.org'
  );
}

export function getBaseProvider(): providers.StaticJsonRpcProvider {
  return new providers.StaticJsonRpcProvider(getBaseRpcUrl(), {
    chainId: BASE_CHAIN_ID,
    name: 'base',
  });
}

/**
 * Live ETH/USD price. Reads the Chainlink feed on Base first, and falls back
 * to Coinbase's public spot price if the on-chain read fails.
 */
export async function getEthUsdPrice(): Promise<number> {
  try {
    const feed = new Contract(ETH_USD_FEED, AGGREGATOR_ABI, getBaseProvider());
    const [, answer] = await feed.latestRoundData();
    const decimals: number = await feed.decimals();
    const price = Number(utils.formatUnits(answer, decimals));
    if (price > 0) return price;
  } catch (err) {
    console.warn('[crypto-payment] Chainlink ETH/USD read failed, falling back:', err);
  }

  const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
    cache: 'no-store',
  });
  const body = await res.json().catch(() => null);
  const price = Number(body?.data?.amount);
  if (!price || price <= 0) {
    throw new Error('Could not determine the current ETH price.');
  }
  return price;
}

export interface CryptoQuote {
  usdAmount: number;
  usdc: { amount: string; decimals: number; display: string };
  eth: { amount: string; decimals: number; display: string; usdPrice: number };
}

/**
 * Quotes the membership price (given in US cents) in both USDC and ETH.
 * `amount` fields are base units (USDC: 6 dp, ETH: wei) as decimal strings.
 */
export async function quoteCryptoPrice(priceCents: number): Promise<CryptoQuote> {
  const usd = priceCents / 100;

  // USDC has 6 decimals; cents already carry 2, so scale by 10^4.
  const usdcUnits = BigNumber.from(priceCents).mul(BigNumber.from(10).pow(USDC_DECIMALS - 2));

  const ethPrice = await getEthUsdPrice();
  const ethFloat = usd / ethPrice;
  const ethWei = utils.parseUnits(ethFloat.toFixed(18), 18);

  return {
    usdAmount: usd,
    usdc: {
      amount: usdcUnits.toString(),
      decimals: USDC_DECIMALS,
      display: usd.toFixed(2),
    },
    eth: {
      amount: ethWei.toString(),
      decimals: 18,
      display: ethFloat.toFixed(5),
      usdPrice: ethPrice,
    },
  };
}

export interface PaymentVerification {
  ok: boolean;
  reason?: string;
  amount?: string;
  from?: string;
}

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Verifies that `txHash` is a confirmed payment of at least `minAmount`
 * (base units) of `currency` from `expectedSender` to `recipient` on Base.
 */
export async function verifyPayment(opts: {
  txHash: string;
  currency: 'eth' | 'usdc';
  recipient: string;
  expectedSender: string;
  minAmount: BigNumber;
}): Promise<PaymentVerification> {
  const { txHash, currency, recipient, expectedSender, minAmount } = opts;

  if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return { ok: false, reason: 'That does not look like a valid transaction hash.' };
  }

  const provider = getBaseProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { ok: false, reason: 'Payment is not confirmed on Base yet. Try again in a moment.' };
  }
  if (receipt.status === 0) {
    return { ok: false, reason: 'The payment transaction failed on-chain.' };
  }

  const recip = normalizeAddress(recipient);
  const sender = normalizeAddress(expectedSender);

  if (currency === 'eth') {
    const tx = await provider.getTransaction(txHash);
    if (!tx) {
      return { ok: false, reason: 'Payment transaction could not be read.' };
    }
    const from = normalizeAddress(tx.from || '');
    if (from !== sender) {
      return { ok: false, reason: 'That payment was not sent from your wallet.' };
    }
    if ((tx.to || '').toLowerCase() !== recip) {
      return { ok: false, reason: 'That payment was not sent to the membership wallet.' };
    }
    if (tx.value.lt(minAmount)) {
      return { ok: false, reason: 'The ETH amount paid is below the membership price.' };
    }
    return { ok: true, amount: tx.value.toString(), from };
  }

  // USDC: sum every Transfer log from the USDC contract into the recipient.
  let total = BigNumber.from(0);
  let from = '';
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== USDC_ADDRESS) continue;
    if ((log.topics[0] || '').toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
    if (log.topics.length < 3) continue;
    const to = '0x' + log.topics[2].slice(26);
    if (to.toLowerCase() !== recip) continue;
    const transferFrom = normalizeAddress('0x' + log.topics[1].slice(26));
    if (transferFrom !== sender) continue;
    total = total.add(BigNumber.from(log.data));
    from = transferFrom;
  }

  if (total.isZero()) {
    return { ok: false, reason: 'No direct USDC payment from your wallet to the membership wallet was found in that transaction.' };
  }
  if (total.lt(minAmount)) {
    return { ok: false, reason: 'The USDC amount paid is below the membership price.' };
  }
  return { ok: true, amount: total.toString(), from: from.toLowerCase() };
}
