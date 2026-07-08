import { NextResponse } from 'next/server';
import { Contract, providers, utils, Wallet } from 'ethers';
import { getChainConfig, resolveVerifiedRpcUrl } from '@/lib/chain-config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily reflections drop — the treasury-to-holders cbBTC pipeline.
 *
 * Runs once a day via Vercel Cron (see vercel.json). Two steps, both
 * idempotent and safe to re-run:
 *   1. Sweep: any cbBTC sitting in Blue's treasury wallet above the floor is
 *      approved and deposited into the ReflectionVault — accrual to every
 *      eligible holder (>= 1,000 BLUE, house excluded) is instant and
 *      pro-rata at the deposit block.
 *   2. Payout: vault.process() walks the holder queue and pushes everyone's
 *      pending cbBTC straight to their wallet. Holders can also pull with
 *      claim() themselves at any time.
 *
 * No-ops cleanly when the active chain has no vault (mainnet until the V2
 * deploy), when the treasury is under the floor, or when there is nothing
 * pending. If CRON_SECRET is set, requests must present it as a bearer
 * token; Vercel Cron supplies this header automatically.
 */

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
];
const VAULT_ABI = [
  'function totalShares() view returns (uint256)',
  'function holderCount() view returns (uint256)',
  'function depositReflections(uint256 amount)',
  'function process(uint256 gasBudget) returns (uint256 iterations, uint256 claims)',
];

/** Smallest treasury balance worth a deposit, in cbBTC base units (8 dec). */
function getDepositFloor(): number {
  const floor = Number(process.env.REFLECTIONS_MIN_DEPOSIT_SATS || 1000);
  return Number.isFinite(floor) && floor > 0 ? floor : 1000;
}

async function runReflections(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }
  }

  const cfg = getChainConfig();
  if (!cfg.reflectionVaultAddress || !cfg.cbBTcAddress) {
    return NextResponse.json({ skipped: `No reflection vault on ${cfg.chainName}.` });
  }

  // Temporary diagnostic for the 2026-07-08 outage: reports what this lambda
  // actually sees through the resolved RPC, with credentials masked.
  if (new URL(request.url).searchParams.get('debug') === '1') {
    const url = await resolveVerifiedRpcUrl();
    const probe = async (method: string, params: unknown[]) => {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          signal: AbortSignal.timeout(8000),
        });
        const data = await res.json().catch(() => null);
        if (data?.error) return `rpc error: ${JSON.stringify(data.error).slice(0, 120)}`;
        const r = String(data?.result ?? 'null');
        return r.length > 20 ? `${r.slice(0, 18)}… (${r.length} chars)` : r;
      } catch (e: unknown) {
        return `fetch failed: ${e instanceof Error ? e.message : 'unknown'}`;
      }
    };
    return NextResponse.json({
      chain: cfg.chainName,
      rpcHost: new URL(url).host,
      configuredHost: new URL(cfg.rpcUrl).host,
      chainIdReported: await probe('eth_chainId', []),
      tokenCode: await probe('eth_getCode', [cfg.diamondsTokenAddress, 'latest']),
      cbbtcCode: await probe('eth_getCode', [cfg.cbBTcAddress, 'latest']),
      cbbtcAddressUsed: cfg.cbBTcAddress,
      tokenAddressUsed: cfg.diamondsTokenAddress,
    });
  }

  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Treasury key not configured.' }, { status: 500 });
  }

  try {
    const provider = new providers.StaticJsonRpcProvider(await resolveVerifiedRpcUrl(), {
      chainId: cfg.chainId,
      name: cfg.chainName.toLowerCase().replace(/\s+/g, '-'),
    });
    const blue = new Wallet(key.startsWith('0x') ? key : `0x${key}`, provider);
    const cbbtc = new Contract(cfg.cbBTcAddress, ERC20_ABI, blue);
    const vault = new Contract(cfg.reflectionVaultAddress, VAULT_ABI, blue);

    const result: {
      chain: string;
      deposited: string | null;
      depositTx: string | null;
      processed: { claims: number } | null;
      processTx: string | null;
    } = { chain: cfg.chainName, deposited: null, depositTx: null, processed: null, processTx: null };

    // 1. Sweep the treasury into the vault.
    const balance = await cbbtc.balanceOf(blue.address);
    const totalShares = await vault.totalShares();
    if (balance.gte(getDepositFloor()) && totalShares.gt(0)) {
      const approveTx = await cbbtc.approve(cfg.reflectionVaultAddress, balance);
      await approveTx.wait();
      const depositTx = await vault.depositReflections(balance);
      await depositTx.wait();
      result.deposited = utils.formatUnits(balance, 8);
      result.depositTx = depositTx.hash;
    }

    // 2. Push payouts to every holder with pending rewards.
    const holderCount = await vault.holderCount();
    if (holderCount.gt(0)) {
      const processTx = await vault.process(600_000, { gasLimit: 1_500_000 });
      const receipt = await processTx.wait();
      const vaultAddr = cfg.reflectionVaultAddress.toLowerCase();
      const claims = receipt.logs.filter(
        (log: { address: string }) => log.address.toLowerCase() === vaultAddr,
      ).length;
      result.processed = { claims };
      result.processTx = receipt.transactionHash;
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[cron/reflections] failed:', message);
    return NextResponse.json({ error: message.slice(0, 300) }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return runReflections(request);
}

export async function POST(request: Request) {
  return runReflections(request);
}
