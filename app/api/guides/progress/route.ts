import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { completeGuide, getUserGuideProgress } from '@/lib/guides-db';
import { awardGuideRewards } from '@/lib/guide-rewards-db';
import {
  progressBodySchema,
  zodErrorBody,
  type ProgressListResponse,
  type ProgressCompleteResponse,
} from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }
  const completed = await getUserGuideProgress(userId);
  return NextResponse.json(
    { completedGuideIds: Array.from(completed) } satisfies ProgressListResponse,
  );
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let userId: string;
  try {
    ({ userId } = await requireUser(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = progressBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }
  const body = parsed.data;

  try {
    // completeGuide enforces the gate server-side: all direct prereqs must be
    // completed by this user, otherwise it throws with .status = 409.
    const result = await completeGuide(userId, body.guideId);
    // Idempotent diamond payout for this completion (per-guide reward, plus
    // level-clear / walkthrough-complete bonuses when applicable). Additive to
    // the response; existing fields are unchanged.
    const rewards = await awardGuideRewards(userId, body.guideId);
    return NextResponse.json({
      ok: true,
      completedAt: result.completedAt,
      diamonds: rewards.diamonds,
      levelCleared: rewards.levelCleared,
      walkthroughComplete: rewards.walkthroughComplete,
      spinGranted: rewards.spinGranted,
    } satisfies ProgressCompleteResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
