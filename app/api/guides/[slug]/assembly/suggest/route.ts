import { NextResponse } from 'next/server';
import { requireVip } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import { materializeAssembly, recordAxiomSuggestion } from '@/lib/guide-assembly-db';
import { assemblySuggestBodySchema, zodErrorBody, type OkResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/[slug]/assembly/suggest — a VIP member proposes a rewrite
 * of one axiom. Records a flag verdict plus the suggestion text in one
 * transaction (lib/guide-assembly-db.ts); suggestions queue as 'pending' for
 * Blue to fold into the guide. VIP-gated: requireVip 403s non-holders.
 * Published-only; materializes first so the node id and contentVersion are
 * current, mirroring the verdict route.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  let userId: string;
  try {
    ({ userId } = await requireVip(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = assemblySuggestBodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(zodErrorBody(parsed.error), { status: 400 });
  }

  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  if (guide.status !== 'published') {
    return NextResponse.json({ error: 'Only published guides can be assembled.' }, { status: 403 });
  }

  try {
    const draft = await materializeAssembly(guide.id, guide.body, guide.topicTitle);
    await recordAxiomSuggestion(
      userId,
      guide.id,
      draft.contentVersion,
      parsed.data.nodeId,
      parsed.data.suggestion,
    );
    return NextResponse.json({ ok: true } satisfies OkResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
