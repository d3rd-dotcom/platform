import { NextRequest, NextResponse } from 'next/server';
import { providers, utils } from 'ethers';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { getDiamondsTokenAddress } from '@/lib/diamonds-onchain';
import { getChainConfig } from '@/lib/chain-config';
import { getDiamondPrice } from '@/lib/shop-catalog';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const TX_HASH_PATTERN = /^0x[0-9a-fA-F]{64}$/;

const ERC20_INTERFACE = new utils.Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);

function getBaseProvider(): providers.JsonRpcProvider {
  const cfg = getChainConfig();
  const rpcUrl = cfg.chainId === 8453
    ? process.env.BASE_RPC_URL || cfg.rpcUrl
    : cfg.rpcUrl;
  return new providers.JsonRpcProvider(rpcUrl);
}

/**
 * Verify the supplied tx is a confirmed burn of at least `requiredDiamonds`
 * $BLUE, from the signed-in user's wallet to the dead address, emitted by the
 * Diamonds token. Fail closed on any mismatch.
 */
async function verifyBurnTx(
  txHash: string,
  userWallet: string,
  requiredDiamonds: number,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const tokenAddress = getDiamondsTokenAddress();
  if (!tokenAddress) return { ok: false, reason: 'token_not_configured' };

  const provider = getBaseProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) return { ok: false, reason: 'tx_not_found' };
  if (receipt.status !== 1) return { ok: false, reason: 'tx_failed' };
  if (receipt.from.toLowerCase() !== userWallet.toLowerCase()) return { ok: false, reason: 'wrong_sender' };

  const required = utils.parseUnits(String(requiredDiamonds), 18);

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== tokenAddress.toLowerCase()) continue;
    let parsed;
    try {
      parsed = ERC20_INTERFACE.parseLog(log);
    } catch {
      continue;
    }
    if (parsed.name !== 'Transfer') continue;
    if (String(parsed.args.from).toLowerCase() !== userWallet.toLowerCase()) continue;
    if (String(parsed.args.to).toLowerCase() !== BURN_ADDRESS.toLowerCase()) continue;
    if (parsed.args.value.lt(required)) continue;
    return { ok: true };
  }

  return { ok: false, reason: 'no_burn_transfer' };
}

let schemaEnsured = false;
async function ensurePurchaseSchema() {
  if (schemaEnsured) return;
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS shop_purchases (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id VARCHAR(36) NOT NULL,
      wallet_address VARCHAR(64) NOT NULL,
      item_id VARCHAR(64) NOT NULL,
      diamonds INTEGER NOT NULL,
      tx_hash VARCHAR(80) NOT NULL UNIQUE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  schemaEnsured = true;
}

/**
 * POST /api/shop/purchase
 * Body: { itemId, txHash } — the hash of a confirmed $BLUE burn covering the
 * item's diamond price. The server owns the price (never trusts the client),
 * verifies the burn on-chain, and records it (one purchase per tx hash).
 */
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rl = checkRateLimit({
    max: 20,
    windowMs: 60 * 60 * 1000,
    identifier: `shop-purchase:${user.id}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: { itemId?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const itemId = typeof body.itemId === 'string' ? body.itemId : '';
  const price = getDiamondPrice(itemId);
  if (!price) {
    return NextResponse.json({ error: 'unknown_item' }, { status: 400 });
  }

  const txHash = body.txHash?.trim();
  if (!txHash || !TX_HASH_PATTERN.test(txHash)) {
    return NextResponse.json({ error: 'invalid_tx', price }, { status: 400 });
  }

  let verification;
  try {
    verification = await verifyBurnTx(txHash, user.walletAddress, price);
  } catch (error) {
    console.error('Shop burn verification failed:', error);
    return NextResponse.json({ error: 'verify_failed' }, { status: 502 });
  }

  if (!verification.ok) {
    return NextResponse.json(
      { error: 'burn_not_verified', reason: verification.reason, price },
      { status: 402 }
    );
  }

  await ensurePurchaseSchema();
  try {
    await sqlQuery(
      `INSERT INTO shop_purchases (user_id, wallet_address, item_id, diamonds, tx_hash)
       VALUES (:userId, :walletAddress, :itemId, :diamonds, :txHash)`,
      {
        userId: user.id,
        walletAddress: user.walletAddress,
        itemId,
        diamonds: price,
        txHash: txHash.toLowerCase(),
      }
    );
  } catch (err: any) {
    if (err?.code === '23505') {
      return NextResponse.json({ error: 'tx_already_used' }, { status: 409 });
    }
    throw err;
  }

  return NextResponse.json({ ok: true, itemId, diamondsBurned: price });
}
