import { NextResponse } from 'next/server';
import { assertCourseUser } from '@/lib/assert-course-auth';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { listGuides, createGuide, type GuideStatus } from '@/lib/guides-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_STATUSES: GuideStatus[] = [
  'draft',
  'pending_verification',
  'published',
  'unpublished',
  'forked',
];

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject') ?? undefined;

    // `?mine=1` returns the caller's own in-progress guides (draft +
    // pending_verification) so authors can find their way back to them from the
    // Knowledge Base. Unauthenticated callers get an empty list, not an error.
    if (searchParams.get('mine') === '1') {
      const user = await getCurrentUserFromRequestCookie();
      if (!user) {
        return NextResponse.json({ guides: [] });
      }
      const guides = await listGuides({
        authorId: user.id,
        statuses: ['draft', 'pending_verification'],
      });
      return NextResponse.json({ guides });
    }

    const statusParam = searchParams.get('status');
    // Public listing defaults to published; other statuses are readable but the
    // knowledge base surfaces only published guides.
    const status = (statusParam && VALID_STATUSES.includes(statusParam as GuideStatus))
      ? (statusParam as GuideStatus)
      : 'published';

    const guides = await listGuides({ subject, status });
    return NextResponse.json({ guides });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await assertCourseUser();
    const body = (await request.json()) as {
      topicTitle?: unknown;
      slug?: unknown;
      body?: unknown;
    };

    if (!body.topicTitle || typeof body.topicTitle !== 'string' || !body.topicTitle.trim()) {
      return NextResponse.json({ error: 'topicTitle is required.' }, { status: 400 });
    }

    const topicTitle = body.topicTitle.trim();
    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? slugify(body.slug)
        : slugify(topicTitle);

    if (!slug) {
      return NextResponse.json({ error: 'Could not derive a slug from the title.' }, { status: 400 });
    }

    // New guides always enter as drafts; verification (Phase 3) promotes them.
    const guide = await createGuide({
      slug,
      topicTitle,
      body: Array.isArray(body.body) ? (body.body as any[]) : [],
      authorId: userId,
      status: 'draft',
    });

    return NextResponse.json({ guide }, { status: 201 });
  } catch (err: any) {
    // Unique violation on slug / topic_title
    if (err?.code === '23505') {
      return NextResponse.json(
        { error: 'A guide with that topic or slug already exists.' },
        { status: 409 },
      );
    }
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
