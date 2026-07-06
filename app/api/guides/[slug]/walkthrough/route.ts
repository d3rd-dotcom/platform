import { NextResponse } from 'next/server';
import { optionalUser } from '@/lib/guide-api-auth';
import { getGuideBySlug, getWalkthrough } from '@/lib/guides-db';
import type { WalkthroughResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { slug: string } }) {
  try {
    const guide = await getGuideBySlug(params.slug);
    if (!guide) {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }
    if (guide.status !== 'published') {
      return NextResponse.json({ error: 'Guide not found.' }, { status: 404 });
    }

    // Reading a walkthrough is public; sign-in only enriches it with progress.
    const auth = await optionalUser(_request);
    const walkthrough = await getWalkthrough(guide.id, auth?.userId ?? null);

    return NextResponse.json({
      guide: { id: guide.id, slug: guide.slug, topicTitle: guide.topicTitle },
      walkthrough,
      authenticated: Boolean(auth),
    } satisfies WalkthroughResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
