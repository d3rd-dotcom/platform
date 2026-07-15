import { NextResponse } from 'next/server';
import { optionalUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getGuideBySlug } from '@/lib/guides-db';
import { materializeAssembly, getAssemblyTree } from '@/lib/guide-assembly-db';
import { ASSEMBLY_REVIEW_REWARD } from '@/lib/guide-rewards-db';
import type { AssemblyTreeResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/guides/[slug]/assembly
 *
 * The guide's Assembly-Theory decomposition (sections of axioms), the caller's
 * verdicts + run state, and community aggregates. Materializes the
 * decomposition on first read (idempotent, deterministic). Only PUBLISHED guides
 * are playable — that is the same contract completeGuide and the reward path
 * enforce; an unpublished guide returns `available: false` with empty sections.
 */
export async function GET(request: Request, { params }: { params: { slug: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  try {
    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }

    const auth = await optionalUser(request);
    const userId = auth?.userId ?? null;
    const isAuthor = !!userId && guide.authorId === userId;

    const baseGuide = { id: guide.id, slug: guide.slug, topicTitle: guide.topicTitle };

    // Unpublished guides never pay and are not playable. Keep the response shape
    // stable so the client can render an "unavailable" state without special-casing.
    if (guide.status !== 'published') {
      return NextResponse.json({
        available: false,
        reason: 'not_published',
        guide: baseGuide,
        reward: ASSEMBLY_REVIEW_REWARD,
        isAuthor,
        authenticated: !!userId,
        contentVersion: '',
        axiomCount: 0,
        verdictCount: 0,
        started: false,
        claimed: false,
        sections: [],
      } satisfies AssemblyTreeResponse);
    }

    const draft = await materializeAssembly(guide.id, guide.body, guide.topicTitle);
    const tree = await getAssemblyTree(guide.id, userId);
    const available = tree.axiomCount > 0;

    return NextResponse.json({
      available,
      reason: available ? undefined : 'empty',
      guide: baseGuide,
      reward: ASSEMBLY_REVIEW_REWARD,
      isAuthor,
      authenticated: !!userId,
      contentVersion: tree.contentVersion || draft.contentVersion,
      axiomCount: tree.axiomCount,
      verdictCount: tree.verdictCount,
      started: tree.started,
      claimed: tree.claimed,
      sections: tree.sections,
    } satisfies AssemblyTreeResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
