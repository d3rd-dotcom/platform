import { NextResponse } from 'next/server';
import { fetchTreasurySnapshot } from '@/lib/treasury-snapshot';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snapshot = await fetchTreasurySnapshot();
    return NextResponse.json(snapshot, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('GET /api/treasury/snapshot error:', error);
    return NextResponse.json(
      { error: 'Treasury balances are temporarily unavailable.', code: 'TREASURY_READ_FAILED' },
      { status: 502 },
    );
  }
}
