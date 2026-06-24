import { NextRequest, NextResponse } from 'next/server';
import { getTelegramAndWalletFromPrivyToken } from '@/lib/privy-auth';
import { ensureTelegramApprovalsSchema } from '@/lib/ensureTelegramApprovalsSchema';
import { walletHoldsAcademicAngel } from '@/lib/academic-angels';
import { sqlQuery, isDbConfigured } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    if (!token.includes('.')) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 401 });
    }

    const result = await getTelegramAndWalletFromPrivyToken(token);
    if (!result) {
      return NextResponse.json(
        { error: 'Could not resolve Telegram account or wallet. Make sure Telegram is linked in Privy.' },
        { status: 400 }
      );
    }

    const { telegramId, walletAddress } = result;

    const holdsAngel = await walletHoldsAcademicAngel(walletAddress);

    if (!isDbConfigured()) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 503 }
      );
    }

    await ensureTelegramApprovalsSchema();

    const nftContract = process.env.ACADEMIC_ANGELS_ADDRESS ||
      process.env.NEXT_PUBLIC_SCATTER_COLLECTION_ADDRESS || '';

    await sqlQuery(
      `INSERT INTO telegram_approvals (telegram_id, wallet_address, approved, nft_contract, verified_at)
       VALUES (:telegramId, :walletAddress, :approved, :nftContract, CURRENT_TIMESTAMP)
       ON CONFLICT (telegram_id) DO UPDATE SET
         wallet_address = excluded.wallet_address,
         approved = excluded.approved,
         nft_contract = excluded.nft_contract,
         verified_at = excluded.verified_at,
         updated_at = CURRENT_TIMESTAMP`,
      {
        telegramId,
        walletAddress,
        approved: holdsAngel ? 1 : 0,
        nftContract,
      }
    );

    if (holdsAngel) {
      return NextResponse.json({
        approved: true,
        telegramId,
        walletAddress,
        nftContract,
        message: 'Academic Angel verified. You now have Telegram channel access.',
      });
    }

    return NextResponse.json({
      approved: false,
      telegramId,
      walletAddress,
      message: 'Your wallet does not hold an Academic Angel NFT.',
    });
  } catch (error: any) {
    console.error('[Telegram Verify] Error:', error?.message || error);
    return NextResponse.json(
      { error: 'Verification failed' },
      { status: 500 }
    );
  }
}
