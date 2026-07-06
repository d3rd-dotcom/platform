import { NextResponse } from 'next/server';
import { requireVip } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import {
  getGuideBySlug,
  getDirectPrereqs,
  addGuidePrereq,
  removeGuidePrereq,
  searchPublishedGuides,
  createForwardRef,
  removeForwardRef,
  getForwardRefs,
} from '@/lib/guides-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Prerequisite-edge management for a guide, author-only for the guide's own
 * draft. Edges are prereq_id → guide_id ("prereq must be done before this
 * guide"). The DB cycle-guard trigger rejects edges that would create a cycle in
 * the DAG (Postgres P0001); we translate that into a clean 400 with a human
 * message. Only PUBLISHED guides are eligible prerequisites.
 *
 * Forward references let authors declare a dependency on a topic that does not
 * yet exist as a published guide. They appear in the prereq list with a
 * "forthcoming" tag and auto-resolve when a matching guide is created.
 */

/** True when the error is the guide_edges cycle-guard trigger firing. */
function isCycleError(err: any): boolean {
  return err?.code === 'P0001' && typeof err?.message === 'string' && err.message.includes('cycle');
}

async function requireDraftOwner(slug: string) {
  const { userId } = await requireVip();
  const guide = await getGuideBySlug(slug);
  if (!guide) {
    throw Object.assign(new Error('Guide not found.'), { status: 404 });
  }
  if (guide.authorId !== userId) {
    throw Object.assign(new Error('Only the author can manage prerequisites.'), { status: 403 });
  }
  if (guide.status !== 'draft') {
    throw Object.assign(
      new Error('Prerequisites can only be edited while the guide is a draft.'),
      { status: 409 },
    );
  }
  return guide;
}

/**
 * GET /api/guides/[slug]/prereqs — current prerequisites, forward refs, and a
 * search of eligible published guides (via ?q=). Author-only.
 * Returns { prereqs, candidates, forwardRefs }.
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  try {
    const guide = await requireDraftOwner(params.slug);
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? undefined;

    const [prereqs, candidates, forwardRefs] = await Promise.all([
      getDirectPrereqs(guide.id),
      searchPublishedGuides({ query: q, excludeId: guide.id }),
      getForwardRefs(guide.id),
    ]);

    // Hide already-linked prereqs from the candidate list.
    const linked = new Set(prereqs.map((p) => p.id));
    return NextResponse.json({
      prereqs,
      candidates: candidates.filter((c) => !linked.has(c.id)),
      forwardRefs,
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * POST /api/guides/[slug]/prereqs
 *
 * Two modes:
 *   { prereqId: "..." }        — add a real prerequisite edge (existing guide)
 *   { forwardRef: true, topicTitle: "..." } — add a forward reference to a future topic
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  try {
    const guide = await requireDraftOwner(params.slug);
    const body = (await request.json().catch(() => ({}))) as {
      prereqId?: unknown;
      forwardRef?: unknown;
      topicTitle?: unknown;
    };

    // Forward reference mode.
    if (body.forwardRef) {
      if (!body.topicTitle || typeof body.topicTitle !== 'string' || !body.topicTitle.trim()) {
        return NextResponse.json(
          { error: 'topicTitle is required for a forward reference.' },
          { status: 400 },
        );
      }
      const ref = await createForwardRef(guide.id, body.topicTitle.trim(), guide.authorId!);
      const forwardRefs = await getForwardRefs(guide.id);
      return NextResponse.json({ forwardRefs, forwardRef: ref }, { status: 201 });
    }

    // Regular prereq mode.
    if (!body.prereqId || typeof body.prereqId !== 'string') {
      return NextResponse.json({ error: 'prereqId is required.' }, { status: 400 });
    }

    await addGuidePrereq(guide.id, body.prereqId);
    const prereqs = await getDirectPrereqs(guide.id);
    return NextResponse.json({ prereqs }, { status: 201 });
  } catch (err: any) {
    if (isCycleError(err)) {
      return NextResponse.json(
        {
          error:
            'That guide already builds on this one, so adding it as a prerequisite would create a loop. Pick a different guide.',
        },
        { status: 400 },
      );
    }
    // Foreign-key violation → the referenced guide id doesn't exist.
    if (err?.code === '23503') {
      return NextResponse.json({ error: 'That guide no longer exists.' }, { status: 400 });
    }
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}

/**
 * DELETE /api/guides/[slug]/prereqs
 *
 * Two modes:
 *   ?prereqId=...     — remove a real prerequisite edge
 *   ?forwardRefId=... — remove a forward reference
 */
export async function DELETE(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  try {
    const guide = await requireDraftOwner(params.slug);
    const { searchParams } = new URL(request.url);
    const prereqId = searchParams.get('prereqId');
    const forwardRefId = searchParams.get('forwardRefId');

    if (forwardRefId) {
      await removeForwardRef(forwardRefId);
      const forwardRefs = await getForwardRefs(guide.id);
      return NextResponse.json({ forwardRefs });
    }

    if (!prereqId) {
      return NextResponse.json(
        { error: 'prereqId or forwardRefId is required.' },
        { status: 400 },
      );
    }

    await removeGuidePrereq(guide.id, prereqId);
    const prereqs = await getDirectPrereqs(guide.id);
    return NextResponse.json({ prereqs });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
