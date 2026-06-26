import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { getVipCourses, createVipCourse } from '@/lib/vip-course-db';
import type { VipCourseRecord } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function assertVipUser(): Promise<{ userId: string; wallet: string }> {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    throw Object.assign(new Error('Sign in to access courses.'), { status: 401 });
  }
  const hasMembership = await walletHoldsVipMembershipCard(user.walletAddress);
  if (!hasMembership) {
    throw Object.assign(new Error('A VIP membership is required.'), { status: 403, code: 'vip_required' });
  }
  return { userId: user.id, wallet: user.walletAddress };
}

export async function GET() {
  try {
    const { userId } = await assertVipUser();
    const courses: VipCourseRecord[] = await getVipCourses(userId);
    return NextResponse.json({ courses });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await assertVipUser();
    const body = await request.json() as { slug?: unknown; title?: unknown; focus?: unknown; coverImageUrl?: unknown };

    if (!body.slug || typeof body.slug !== 'string' || !body.slug.trim()) {
      return NextResponse.json({ error: 'slug is required.' }, { status: 400 });
    }
    if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required.' }, { status: 400 });
    }

    const course = await createVipCourse({
      userId,
      slug: body.slug.trim(),
      title: body.title.trim(),
      focus: typeof body.focus === 'string' ? body.focus.trim() : '',
      coverImageUrl: typeof body.coverImageUrl === 'string' ? body.coverImageUrl : null,
    });

    return NextResponse.json({ course }, { status: 201 });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
