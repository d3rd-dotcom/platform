import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { getGuideBySlug, getWalkthrough } from '@/lib/guides-db';

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
    const user = await getCurrentUserFromRequestCookie().catch(() => null);
    const walkthrough = await getWalkthrough(guide.id, user?.id ?? null);

    return NextResponse.json({
      guide: { id: guide.id, slug: guide.slug, topicTitle: guide.topicTitle },
      walkthrough,
      authenticated: Boolean(user),
    });
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
