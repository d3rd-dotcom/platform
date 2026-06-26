import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { updateVipCourse } from '@/lib/vip-course-db';

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

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await assertVipUser();
    const course = await updateVipCourse(params.id, { status: 'published' });
    if (!course) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
