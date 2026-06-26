import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { createCourseWeek } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertVipUser(): Promise<string> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  const hasMembership = await walletHoldsVipMembershipCard(user.walletAddress);
  if (!hasMembership) {
    throw Object.assign(new Error('A VIP membership is required.'), { status: 403, code: 'vip_required' });
  }
  return user.id;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    await assertVipUser();
    const body = await request.json() as { weekNumber?: unknown; title?: unknown; theme?: unknown; sortOrder?: unknown };

    if (body.weekNumber === undefined || typeof body.weekNumber !== 'number') {
      return NextResponse.json({ error: 'weekNumber is required and must be a number.' }, { status: 400 });
    }
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    const week = await createCourseWeek({
      courseId: params.id,
      weekNumber: body.weekNumber,
      title: body.title.trim(),
      theme: typeof body.theme === 'string' ? body.theme.trim() : '',
      sortOrder: typeof body.sortOrder === 'number' ? body.sortOrder : undefined,
    });

    return NextResponse.json({ week }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
