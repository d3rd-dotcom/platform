import { NextResponse } from 'next/server';
import { createPublicClient, createWalletClient, http, formatUnits } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, baseSepolia } from 'viem/chains';
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
 * Built on viem, not ethers: ethers v5's node HTTP transport fails inside
 * Vercel lambdas ("missing response", 2026-07-08 outage) while fetch-based
 * transports work. viem rides the platform fetch.
 *
 * No-ops cleanly when the active chain has no vault (mainnet until the V2
 * deploy), when the treasury is under the floor, or when there is nothing
 * pending. If CRON_SECRET is set, requests must present it as a bearer
 * token; Vercel Cron supplies this header automatically.
 */

const ERC20_ABI = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const VAULT_ABI = [
  { type: 'function', name: 'totalShares', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'holderCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'depositReflections', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'process', stateMutability: 'nonpayable', inputs: [{ type: 'uint256' }], outputs: [{ type: 'uint256' }, { type: 'uint256' }] },
] as const;

/** Smallest treasury balance worth a deposit, in cbBTC base units (8 dec). */
function getDepositFloor(): bigint {
  const floor = Number(process.env.REFLECTIONS_MIN_DEPOSIT_SATS || 1000);
  return BigInt(Number.isFinite(floor) && floor > 0 ? Math.round(floor) : 1000);
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

  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    return NextResponse.json({ error: 'Treasury key not configured.' }, { status: 500 });
  }

  try {
    const rpcUrl = await resolveVerifiedRpcUrl();
    const chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
    const blue = privateKeyToAccount((key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`);
    const client = createPublicClient({ chain, transport: http(rpcUrl) });
    const wallet = createWalletClient({ account: blue, chain, transport: http(rpcUrl) });

    const vault = cfg.reflectionVaultAddress as `0x${string}`;
    const cbbtc = cfg.cbBTcAddress as `0x${string}`;

    // Sequential txs from one account: manage the nonce explicitly so a
    // lagging replica cannot hand out a duplicate.
    let nonce = await client.getTransactionCount({ address: blue.address, blockTag: 'pending' });
    const send = async (tx: Parameters<typeof wallet.writeContract>[0]) => {
      const hash = await wallet.writeContract({ ...tx, nonce: nonce++ } as Parameters<typeof wallet.writeContract>[0]);
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error(`${String(tx.functionName)} reverted (${hash})`);
      return receipt;
    };

    const result: {
      chain: string;
      deposited: string | null;
      depositTx: string | null;
      processed: { claims: number } | null;
      processTx: string | null;
    } = { chain: cfg.chainName, deposited: null, depositTx: null, processed: null, processTx: null };

    // 1. Sweep the treasury into the vault.
    const [balance, totalShares] = await Promise.all([
      client.readContract({ address: cbbtc, abi: ERC20_ABI, functionName: 'balanceOf', args: [blue.address] }),
      client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'totalShares' }),
    ]);
    if (balance >= getDepositFloor() && totalShares > 0n) {
      await send({ address: cbbtc, abi: ERC20_ABI, functionName: 'approve', args: [vault, balance] });
      const depositReceipt = await send({
        address: vault, abi: VAULT_ABI, functionName: 'depositReflections', args: [balance],
      });
      result.deposited = formatUnits(balance, 8);
      result.depositTx = depositReceipt.transactionHash;
    }

    // 2. Push payouts to every holder with pending rewards. Explicit gas so a
    // stale estimate cannot starve the payout loop.
    const holderCount = await client.readContract({ address: vault, abi: VAULT_ABI, functionName: 'holderCount' });
    if (holderCount > 0n) {
      const processReceipt = await send({
        address: vault, abi: VAULT_ABI, functionName: 'process', args: [600_000n], gas: 1_500_000n,
      });
      const claims = processReceipt.logs.filter(
        (log) => log.address.toLowerCase() === vault.toLowerCase(),
      ).length;
      result.processed = { claims };
      result.processTx = processReceipt.transactionHash;
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
