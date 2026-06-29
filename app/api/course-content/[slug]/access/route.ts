import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { checkCourseAccess } from '@/lib/course-access';
import { sqlQuery } from '@/lib/db';
import { ensureCourseContentSchema } from '@/lib/ensureCourseContentSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    await ensureCourseContentSchema();

    const courseRows = await sqlQuery<any[]>(
      `SELECT token_gate FROM academy_courses WHERE slug = :slug AND status = 'published' LIMIT 1`,
      { slug: params.slug },
    );

    if (!courseRows[0]) {
      return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
    }

    const tokenGate: string = courseRows[0].token_gate || '';
    const user = await getCurrentUserFromRequestCookie();
    const { granted, gate } = await checkCourseAccess(tokenGate, user?.walletAddress);

    return NextResponse.json({ granted, gate, tokenGate });
  } catch (err: any) {
    console.error('[course-content/access] Error:', err);
    return NextResponse.json({ error: 'Failed to check access.' }, { status: 500 });
  }
}
