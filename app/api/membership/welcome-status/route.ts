import { NextResponse } from 'next/server';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureMembershipSchema } from '@/lib/ensureMembershipSchema';
import { getWalletAddressFromRequest } from '@/lib/wallet-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Membership welcome screen gate.
 *
 * GET  — true when this wallet has a delivered membership it has not yet been
 *        welcomed for (shown once, on the next login after delivery).
 * POST — marks every such order as welcomed, so the screen does not show again.
 */
export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ show: false });

  const wallet = await getWalletAddressFromRequest();
  if (!wallet) return NextResponse.json({ show: false });

  await ensureMembershipSchema();
  const rows = await sqlQuery<Array<{ id: string }>>(
    `SELECT id FROM membership_orders
      WHERE LOWER(buyer_wallet) = LOWER(:wallet)
        AND status = 'transferred'
        AND welcomed_at IS NULL
      LIMIT 1`,
    { wallet },
  );
  return NextResponse.json({ show: rows.length > 0 });
}

export async function POST() {
  if (!isDbConfigured()) return NextResponse.json({ ok: true });

  const wallet = await getWalletAddressFromRequest();
  if (!wallet) return NextResponse.json({ ok: false }, { status: 401 });

  await ensureMembershipSchema();
  await sqlQuery(
    `UPDATE membership_orders
        SET welcomed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE LOWER(buyer_wallet) = LOWER(:wallet)
        AND status = 'transferred'
        AND welcomed_at IS NULL`,
    { wallet },
  );
  return NextResponse.json({ ok: true });
}
