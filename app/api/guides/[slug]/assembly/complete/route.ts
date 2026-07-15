import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { deliverDiamondsOnchain } from '@/lib/diamonds-onchain';
import { getGuideBySlug } from '@/lib/guides-db';
import { materializeAssembly } from '@/lib/guide-assembly-db';
import { awardAssemblyReward } from '@/lib/guide-rewards-db';
import type { AssemblyCompleteResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/guides/[slug]/assembly/complete — claim the one-time completion
 * reward for a finished Assemble pass.
 *
 * The money path (awardAssemblyReward) re-verifies everything server-side inside
 * its own transaction — published, non-author, every axiom verdicted, time gate,
 * idempotent claim — so this route trusts nothing from the client but the slug.
 * Onchain delivery mirrors the progress route: fail-soft, deduped, keyed on a
 * namespaced ref (`assembly:<guideId>`) so it never collides with the guide's
 * completion delivery.
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

  const guide = await getGuideBySlug(params.slug);
  if (!guide) {
    return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
  }
  if (guide.status !== 'published') {
    return NextResponse.json({ error: 'Only published guides can be assembled.' }, { status: 403 });
  }

  try {
    // Ensure the decomposition is current before completeness is judged.
    await materializeAssembly(guide.id, guide.body, guide.topicTitle);

    const result = await awardAssemblyReward(userId, guide.id);
    const alreadyClaimed = result.reason === 'already_claimed';

    if (result.diamonds > 0) {
      const walletRows = await sqlQuery<Array<{ wallet_address: string | null }>>(
        `SELECT wallet_address FROM users WHERE id = :userId LIMIT 1`,
        { userId },
      );
      await deliverDiamondsOnchain({
        userId,
        walletAddress: walletRows[0]?.wallet_address,
        source: 'guide',
        refId: `assembly:${guide.id}`,
        amount: result.diamonds,
        delivery: 'blue_transfer',
      });
    }

    return NextResponse.json({
      ok: true,
      awarded: result.awarded,
      alreadyClaimed,
      diamonds: result.diamonds,
      reason: result.reason,
    } satisfies AssemblyCompleteResponse);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 });
  }
}
