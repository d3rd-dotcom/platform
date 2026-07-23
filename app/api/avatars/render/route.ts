import { NextRequest, NextResponse } from 'next/server';
import { renderAxisAvatarSvg } from '@/lib/axis-avatar';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_SEED_LENGTH = 128;

export async function GET(request: NextRequest) {
  const seed = request.nextUrl.searchParams.get('seed');
  if (!seed || seed.length > MAX_SEED_LENGTH) {
    return NextResponse.json({ error: 'A valid avatar seed is required.' }, { status: 400 });
  }

  return new NextResponse(renderAxisAvatarSvg(seed), {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Security-Policy': "default-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
