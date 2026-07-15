import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import { materializeAssembly, recordAssemblyVerdict } from '@/lib/guide-assembly-db';
import { assemblyVerdictBodySchema, zodErrorBody, type OkResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/[slug]/assembly/verdict — record (or change) the caller's
 * approve/flag verdict on one axiom. Published-only; materializes first so the
 * node id and contentVersion the verdict is recorded against are current.
 */
export async function POST(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  let userId: string;
  try {
    ({ userId } = await requireUser(request));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const parsed = assemblyVerdictBodySchema.safeParse(await request.json().catch(() => ({})));
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
    await recordAssemblyVerdict(
      userId,
      guide.id,
      draft.contentVersion,
      parsed.data.nodeId,
      parsed.data.verdict,
    );
    return NextResponse.json({ ok: true } satisfies OkResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
