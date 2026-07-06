import { NextResponse } from 'next/server';
import { requireVip } from '@/lib/guide-api-auth';
import {
  getGuideBySlug,
  getGuideMethods,
  getDirectPrereqs,
  getDirectDependents,
  getWalkthrough,
} from '@/lib/guides-db';
import type { GuideDetailResponse } from '@/lib/guide-api-schemas';

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
      const { userId } = await requireVip(_request);
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

    return NextResponse.json(
      { guide, methods, prereqs, dependents, level } satisfies GuideDetailResponse,
    );
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
