import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import {
  getGuideBySlug,
  getGuideMethods,
  getDirectPrereqs,
  getDirectDependents,
  getWalkthrough,
  updateGuide,
  type GuideBodyComponent,
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

/**
 * PATCH /api/guides/[slug] — author edits their own draft (topic title, body,
 * subjects). VIP-gated (assertCourseUser) and author-only, mirroring the create
 * route. Published guides are locked here: once verified, edits flow through
 * the verification/revision path, not free editing.
 *
 * Body: { topicTitle?, body?, subjects? }
 */
export async function PATCH(request: Request, { params }: { params: { slug: string } }) {
  try {
    const userId = await assertCourseUser();

    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }
    if (guide.authorId !== userId) {
      return NextResponse.json(
        { error: 'Only the author can edit this guide.' },
        { status: 403 },
      );
    }
    if (guide.status !== 'draft') {
      return NextResponse.json(
        { error: 'Only draft guides can be edited. This guide is already in review or published.' },
        { status: 409 },
      );
    }

    const raw = (await request.json().catch(() => ({}))) as {
      topicTitle?: unknown;
      body?: unknown;
      subjects?: unknown;
    };

    const patch: {
      id: string;
      topicTitle?: string;
      body?: GuideBodyComponent[];
      subjects?: string[];
    } = { id: guide.id };

    if (raw.topicTitle !== undefined) {
      if (typeof raw.topicTitle !== 'string' || !raw.topicTitle.trim()) {
        return NextResponse.json({ error: 'topicTitle must be a non-empty string.' }, { status: 400 });
      }
      patch.topicTitle = raw.topicTitle.trim();
    }
    if (raw.body !== undefined) {
      if (!Array.isArray(raw.body)) {
        return NextResponse.json({ error: 'body must be an array of components.' }, { status: 400 });
      }
      patch.body = raw.body as GuideBodyComponent[];
    }
    if (raw.subjects !== undefined) {
      if (!Array.isArray(raw.subjects) || raw.subjects.some((s) => typeof s !== 'string')) {
        return NextResponse.json({ error: 'subjects must be an array of strings.' }, { status: 400 });
      }
      patch.subjects = raw.subjects as string[];
    }

    const updated = await updateGuide(patch);
    return NextResponse.json({ guide: updated });
  } catch (err: any) {
    // Unique violation on topic_title
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'A guide with that topic already exists.' },
        { status: 409 },
      );
    }
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
