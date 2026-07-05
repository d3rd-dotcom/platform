import { NextResponse } from 'next/server';
import { isDbConfigured } from '@/lib/db';
import { getVerificationLog } from '@/lib/guide-verification-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/verification/[guideId]
 * PUBLIC verification audit log for a guide: every panel, its DON-signed
 * advisory CRE score, and every rubric-bound vote (decision + rubric item +
 * justification + timestamp). No auth — verification is transparent by design.
 */
export async function GET(
  _request: Request,
  { params }: { params: { guideId: string } },
) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const log = await getVerificationLog(params.guideId);
    if (!log) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }
    return NextResponse.json({ log });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
