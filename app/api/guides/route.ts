import { NextResponse } from 'next/server';
import { requireVip, optionalUser } from '@/lib/guide-api-auth';
import { listGuides, createGuide, resolveForwardRefs, type GuideStatus } from '@/lib/guides-db';
import {
  createGuideBodySchema,
  zodErrorBody,
  type GuidesListResponse,
  type GuideCreateResponse,
} from '@/lib/guide-api-schemas';

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
      const user = await optionalUser();
      if (!user) {
        return NextResponse.json({ guides: [] });
      }
      const guides = await listGuides({
        authorId: user.userId,
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
    return NextResponse.json({ guides } satisfies GuidesListResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireVip(request);
    const parsed = createGuideBodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
    }
    const body = parsed.data;

    // Presence/emptiness is a semantic rule beyond the schema (empty/whitespace
    // titles are rejected with the historical message).
    if (!body.topicTitle.trim()) {
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
      ...(Array.isArray(body.evidenceCriteria)
        ? { evidenceCriteria: body.evidenceCriteria }
        : {}),
    });

    // Auto-resolve any forward references whose topic_title matches this new
    // guide. This runs in the background — it is informational and the response
    // should not wait for it to complete.
    resolveForwardRefs(guide.id).catch(() => {});

    return NextResponse.json({ guide } satisfies GuideCreateResponse, { status: 201 });
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
