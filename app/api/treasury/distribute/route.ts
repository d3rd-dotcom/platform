import { NextResponse } from 'next/server';
import { Contract, providers, utils } from 'ethers';
import { isValidAdminSecret } from '@/lib/admin-secret';
import { getAppleHolders } from '@/lib/apple-holders';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import { distributeUSDC } from '@/lib/blue-usdc';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureTreasuryDistributionSchema } from '@/lib/ensureTreasuryDistributionSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const USDC_DECIMALS = 6;
const DISTRIBUTION_RATE = 0.80;
const DEFAULT_BALANCE_CAP_PCT = 0.05;
const RPC_URL = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';
const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const USDC_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

interface BlueUsdcBalance {
  walletAddress: string;
  usd: number;
}

interface RealizedPnl {
  usd: number;
  source: string;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePositiveNumber(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed != null && parsed > 0 ? parsed : null;
}

function parseNonNegativeNumber(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed != null && parsed >= 0 ? parsed : null;
}

function getBalanceCapPct(): number {
  const configured = process.env.TREASURY_DISTRIBUTION_CAP_PCT;
  if (!configured) return DEFAULT_BALANCE_CAP_PCT;

  const parsed = parsePositiveNumber(configured);
  if (parsed == null || parsed > 1) {
    throw new Error('TREASURY_DISTRIBUTION_CAP_PCT must be a decimal greater than 0 and no more than 1.');
  }
  return parsed;
}

function getHardCapUsdc(): number | null {
  const configured = process.env.TREASURY_DISTRIBUTION_MAX_USDC;
  if (!configured) return null;

  const parsed = parsePositiveNumber(configured);
  if (parsed == null) {
    throw new Error('TREASURY_DISTRIBUTION_MAX_USDC must be a positive USDC amount.');
  }
  return parsed;
}

function getCurrentWeeklyEpochKey(now = new Date()): string {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  return `week:${start.toISOString().slice(0, 10)}`;
}

function roundUsdc(value: number): number {
  return Math.floor(value * 10 ** USDC_DECIMALS) / 10 ** USDC_DECIMALS;
}

function usdcUnitsToUsd(units: string | bigint): number {
  return Number(BigInt(units)) / 10 ** USDC_DECIMALS;
}

async function fetchBlueUsdcBalance(): Promise<BlueUsdcBalance> {
  const walletAddress = getBlueWalletAddress();
  const provider = new providers.JsonRpcProvider(RPC_URL);
  const usdc = new Contract(USDC_ADDRESS, USDC_ABI, provider);
  const [raw, decimals] = await Promise.all([usdc.balanceOf(walletAddress), usdc.decimals()]);
  return {
    walletAddress,
    usd: Number(utils.formatUnits(raw, Number(decimals))),
  };
}

async function getLastPostDistributionBalance(): Promise<number | null> {
  const rows = await sqlQuery<Array<{ post_distribution_balance_usdc: string | null }>>(`
    SELECT post_distribution_balance_usdc
    FROM treasury_distributions
    WHERE status IN ('completed', 'partial_failed')
      AND post_distribution_balance_usdc IS NOT NULL
    ORDER BY completed_at DESC NULLS LAST, created_at DESC
    LIMIT 1
  `);

  return parseNonNegativeNumber(rows[0]?.post_distribution_balance_usdc ?? null);
}

async function getRealizedEpochPnl(walletBalanceUsd: number): Promise<RealizedPnl> {
  const configuredRealized = parseNonNegativeNumber(process.env.TREASURY_DISTRIBUTION_REALIZED_PNL_USDC);
  if (configuredRealized != null) {
    return { usd: configuredRealized, source: 'TREASURY_DISTRIBUTION_REALIZED_PNL_USDC' };
  }

  const configuredBaseline = parseNonNegativeNumber(process.env.TREASURY_DISTRIBUTION_EPOCH_START_BALANCE_USDC);
  if (configuredBaseline != null) {
    return {
      usd: Math.max(0, walletBalanceUsd - configuredBaseline),
      source: 'TREASURY_DISTRIBUTION_EPOCH_START_BALANCE_USDC',
    };
  }

  const lastPostDistributionBalance = await getLastPostDistributionBalance();
  if (lastPostDistributionBalance != null) {
    return {
      usd: Math.max(0, walletBalanceUsd - lastPostDistributionBalance),
      source: 'last_treasury_distribution',
    };
  }

  throw new Error(
    'No server-side realized P&L source configured. Set TREASURY_DISTRIBUTION_REALIZED_PNL_USDC or TREASURY_DISTRIBUTION_EPOCH_START_BALANCE_USDC.',
  );
}

async function reserveDistributionEpoch(input: {
  epochKey: string;
  requestedEpochPnL: number;
  realizedEpochPnL: number;
  realizedSource: string;
  walletAddress: string;
  walletBalance: number;
  balanceCapPct: number;
  balanceCap: number;
  hardCap: number | null;
  approvedEpochPnL: number;
  distributableAmount: number;
  retained: number;
}): Promise<boolean> {
  const rows = await sqlQuery<Array<{ epoch_key: string }>>(
    `
      INSERT INTO treasury_distributions (
        epoch_key,
        requested_epoch_pnl_usdc,
        realized_epoch_pnl_usdc,
        realized_source,
        wallet_address,
        wallet_balance_usdc,
        balance_cap_pct,
        balance_cap_usdc,
        hard_cap_usdc,
        approved_epoch_pnl_usdc,
        distributable_usdc,
        retained_usdc
      ) VALUES (
        :epochKey,
        :requestedEpochPnL,
        :realizedEpochPnL,
        :realizedSource,
        :walletAddress,
        :walletBalance,
        :balanceCapPct,
        :balanceCap,
        :hardCap,
        :approvedEpochPnL,
        :distributableAmount,
        :retained
      )
      ON CONFLICT (epoch_key) DO NOTHING
      RETURNING epoch_key
    `,
    input,
  );

  return rows.length > 0;
}

async function completeDistributionEpoch(input: {
  epochKey: string;
  status: 'completed' | 'partial_failed' | 'failed';
  recipientsProcessed: number;
  txHashes: string[];
  failed: { address: string; error: string }[];
  blockNumber: number;
  postDistributionBalance: number;
}) {
  await sqlQuery(
    `
      UPDATE treasury_distributions
      SET status = :status,
          recipients_processed = :recipientsProcessed,
          tx_hashes = :txHashes::jsonb,
          failed = :failed::jsonb,
          block_number = :blockNumber,
          post_distribution_balance_usdc = :postDistributionBalance,
          updated_at = NOW(),
          completed_at = NOW()
      WHERE epoch_key = :epochKey
    `,
    {
      ...input,
      txHashes: JSON.stringify(input.txHashes),
      failed: JSON.stringify(input.failed),
    },
  );
}

/**
 * POST /api/treasury/distribute
 * Admin-only endpoint to distribute trading profits to APPLE holders.
 * 80% of epoch profits → USDC to holders on Base, 20% retained.
 */
export async function POST(request: Request) {
  const adminSecret = request.headers.get('x-admin-secret');
  if (!isValidAdminSecret(adminSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  try {
    await ensureTreasuryDistributionSchema();

    // Get the body with epoch P&L data
    const body = await request.json();
    const requestedEpochPnL = parsePositiveNumber(body.epochPnL);

    if (requestedEpochPnL == null) {
      return NextResponse.json({
        success: false,
        message: 'No profit to distribute (epochPnL must be positive)',
        epochPnL: parseNumber(body.epochPnL) || 0,
      });
    }

    const blueUsdcBalance = await fetchBlueUsdcBalance();
    const realizedEpochPnL = await getRealizedEpochPnl(blueUsdcBalance.usd);
    const balanceCapPct = getBalanceCapPct();
    const hardCap = getHardCapUsdc();
    const balancePayoutCap = blueUsdcBalance.usd * balanceCapPct;
    const maxEpochPnLByBalance = balancePayoutCap / DISTRIBUTION_RATE;
    const maxEpochPnLByHardCap = hardCap == null ? Number.POSITIVE_INFINITY : hardCap / DISTRIBUTION_RATE;
    const approvedEpochPnL = roundUsdc(Math.min(
      requestedEpochPnL,
      realizedEpochPnL.usd,
      maxEpochPnLByBalance,
      maxEpochPnLByHardCap,
    ));

    if (approvedEpochPnL <= 0) {
      return NextResponse.json({
        success: false,
        message: 'No server-verified profit available to distribute',
        requestedEpochPnL,
        realizedEpochPnL: realizedEpochPnL.usd,
        realizedSource: realizedEpochPnL.source,
        walletBalance: blueUsdcBalance.usd,
        payoutCap: {
          balancePct: balanceCapPct,
          balanceCap: roundUsdc(balancePayoutCap),
          hardCap,
        },
      });
    }

    // 80% goes to holders, 20% retained
    const distributableAmount = roundUsdc(approvedEpochPnL * DISTRIBUTION_RATE);
    const retained = roundUsdc(approvedEpochPnL - distributableAmount);

    const snapshot = await getAppleHolders();
    if (snapshot.totalHolders === 0) {
      return NextResponse.json({
        success: false,
        message: 'No eligible APPLE holders found',
      });
    }

    // Calculate per-holder amounts (USDC has 6 decimals)
    const recipients = snapshot.holders
      .map(h => ({
        address: h.address,
        amount: BigInt(Math.floor(distributableAmount * h.share * 10 ** USDC_DECIMALS)).toString(),
      }))
      .filter(r => BigInt(r.amount) > 0n);

    if (recipients.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No eligible APPLE holders would receive a non-zero USDC amount',
        requestedEpochPnL,
        approvedEpochPnL,
        distributed: 0,
      });
    }

    const epochKey = getCurrentWeeklyEpochKey();
    const reserved = await reserveDistributionEpoch({
      epochKey,
      requestedEpochPnL,
      realizedEpochPnL: realizedEpochPnL.usd,
      realizedSource: realizedEpochPnL.source,
      walletAddress: blueUsdcBalance.walletAddress,
      walletBalance: blueUsdcBalance.usd,
      balanceCapPct,
      balanceCap: roundUsdc(balancePayoutCap),
      hardCap,
      approvedEpochPnL,
      distributableAmount,
      retained,
    });

    if (!reserved) {
      return NextResponse.json(
        {
          success: false,
          message: 'Treasury distribution already reserved for this weekly epoch',
          epochKey,
        },
        { status: 409 },
      );
    }

    // Execute batch distribution
    let txHashes: string[];
    let failed: { address: string; error: string }[];
    try {
      ({ txHashes, failed } = await distributeUSDC(recipients));
    } catch (err) {
      await completeDistributionEpoch({
        epochKey,
        status: 'failed',
        recipientsProcessed: recipients.length,
        txHashes: [],
        failed: [{ address: 'batch', error: err instanceof Error ? err.message : 'Unknown error' }],
        blockNumber: snapshot.blockNumber,
        postDistributionBalance: blueUsdcBalance.usd,
      });
      throw err;
    }
    const failedAddresses = new Set(failed.map(f => f.address.toLowerCase()));
    const sentAmount = recipients
      .filter(r => !failedAddresses.has(r.address.toLowerCase()))
      .reduce((sum, r) => sum + usdcUnitsToUsd(r.amount), 0);
    const postDistributionBalance = roundUsdc(Math.max(0, blueUsdcBalance.usd - sentAmount));
    const status = failed.length === 0
      ? 'completed'
      : txHashes.length > 0
        ? 'partial_failed'
        : 'failed';

    await completeDistributionEpoch({
      epochKey,
      status,
      recipientsProcessed: recipients.length,
      txHashes,
      failed,
      blockNumber: snapshot.blockNumber,
      postDistributionBalance,
    });

    return NextResponse.json({
      success: status !== 'failed',
      epochKey,
      requestedEpochPnL,
      realizedEpochPnL: realizedEpochPnL.usd,
      realizedSource: realizedEpochPnL.source,
      approvedEpochPnL,
      targetDistributed: distributableAmount,
      distributed: roundUsdc(sentAmount),
      retained,
      walletBalance: blueUsdcBalance.usd,
      payoutCap: {
        balancePct: balanceCapPct,
        balanceCap: roundUsdc(balancePayoutCap),
        hardCap,
      },
      totalHolders: snapshot.totalHolders,
      recipientsProcessed: recipients.length,
      txHashes,
      failed,
      blockNumber: snapshot.blockNumber,
    });
  } catch (err) {
    console.error('POST /api/treasury/distribute error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Distribution failed' },
      { status: 500 },
    );
  }
}
