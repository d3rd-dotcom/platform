import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import {
  getGuideBySlug,
  getGuideMethods,
  getDirectPrereqs,
  getDirectDependents,
  getWalkthrough,
} from '@/lib/guides-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }

    // Published guides are public reading. Unpublished/draft/etc. are visible to
    // their author alone (mirrors the VIP course-by-slug convention).
    if (guide.status !== 'published') {
      const userId = await assertCourseUser();
      if (guide.authorId !== userId) {
        return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
      }
    }

    const [methods, prereqs, dependents, walkthrough] = await Promise.all([
      getGuideMethods(guide.id),
      getDirectPrereqs(guide.id),
      getDirectDependents(guide.id),
      getWalkthrough(guide.id),
    ]);

    // The guide's own level = height of its prerequisite closure (1-based).
    const level = Math.max(walkthrough?.levels ?? 1, 1);

    return NextResponse.json({ guide, methods, prereqs, dependents, level });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
