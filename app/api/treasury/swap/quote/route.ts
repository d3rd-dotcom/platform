import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { isAddress } from 'viem';
import { z } from 'zod';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { createTreasurySwapQuote } from '@/lib/cdp-swap';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const requestSchema = z.object({
  fromAsset: z.enum(['bitcoin', 'diamonds', 'eth']),
  toAsset: z.enum(['bitcoin', 'diamonds', 'eth']),
  amount: z.string().trim().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/),
  taker: z.string().refine(isAddress),
});

export async function POST(request: Request) {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json(
      { error: 'Sign in to request a swap quote.', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const limit = checkRateLimit({
    identifier: `treasury-swap-quote:${user.id}`,
    max: 12,
    windowMs: 60_000,
  });
  const headers = getRateLimitHeaders(limit);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many swap quotes. Try again in a minute.', code: 'RATE_LIMITED' },
      { status: 429, headers },
    );
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid swap request.', code: 'INVALID_SWAP_REQUEST' },
      { status: 400, headers },
    );
  }
  if (parsed.data.taker.toLowerCase() !== user.walletAddress.toLowerCase()) {
    return NextResponse.json(
      { error: 'The connected wallet does not match your Academy account.', code: 'WALLET_MISMATCH' },
      { status: 403, headers },
    );
  }

  try {
    const quote = await createTreasurySwapQuote({
      ...parsed.data,
      taker: parsed.data.taker,
      idempotencyKey: randomUUID(),
    });
    return NextResponse.json(quote, { headers });
  } catch (error: unknown) {
    const known = error as { message?: string; status?: number; code?: string };
    const status = known.status ?? 502;
    if (status >= 500) {
      console.error('[treasury-swap] quote failed:', known.message || error);
    }
    return NextResponse.json(
      {
        error: known.message || 'Swap quote is temporarily unavailable.',
        code: known.code || 'SWAP_QUOTE_FAILED',
      },
      { status, headers },
    );
  }
}
