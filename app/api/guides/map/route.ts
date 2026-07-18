import { NextResponse } from 'next/server';
import { optionalUser } from '@/lib/guide-api-auth';
import { getKnowledgeMap } from '@/lib/guides-db';
import type { KnowledgeMapResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const publicOnly = new URL(request.url).searchParams.get('public') === '1';

    if (publicOnly) {
      const map = await getKnowledgeMap(null);
      return NextResponse.json(
        {
          map,
          authenticated: false,
        } satisfies KnowledgeMapResponse,
        {
          headers: {
            'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400',
          },
        },
      );
    }

    // The graph shape is public; signing in only enriches it with completed flags.
    const auth = await optionalUser(request);
    const map = await getKnowledgeMap(auth?.userId ?? null);

    return NextResponse.json({
      map,
      authenticated: Boolean(auth),
    } satisfies KnowledgeMapResponse);
  } catch (err: any) {
    const status = err.status ?? 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
