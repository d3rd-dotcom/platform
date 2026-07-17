import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/guide-api-auth';
import { isDbConfigured } from '@/lib/db';
import { getFrontierGuides, getWalkthrough, searchGuidesForChat } from '@/lib/guides-db';
import type { GuideRecommendCard, GuideRecommendResponse } from '@/lib/guide-api-schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_CARDS = 3;

/** Filler words dropped before matching, so "i want to learn about breathing"
    searches on "breathing" and phrasing never dilutes the score. */
const STOPWORDS = new Set([
  'the', 'and', 'for', 'about', 'with', 'into', 'from', 'that', 'this',
  'what', 'how', 'can', 'could', 'would', 'should', 'want', 'wanna', 'like',
  'learn', 'learning', 'study', 'studying', 'understand', 'understanding',
  'know', 'knowing', 'guide', 'guides', 'better', 'more', 'some', 'any',
  'please', 'you', 'your', 'them', 'they', 'get', 'getting', 'start',
  'starting', 'help', 'need',
]);

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .slice(0, 8);
}

/**
 * GET /api/guides/recommend — knowledge-node cards for Blue's chat.
 *
 * With `?q=`: token-search the published DAG, and for each match return the
 * caller's remaining prerequisite closure (published-only, via getWalkthrough,
 * so it agrees with the completion gate). Without `q`: the caller's frontier —
 * guides they can start right now.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }
  let userId: string;
  try {
    ({ userId } = await requireUser());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: err.status ?? 401 });
  }

  const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';

  if (!q) {
    const frontier = await getFrontierGuides(userId);
    const cards: GuideRecommendCard[] = frontier.slice(0, MAX_CARDS).map((g) => ({
      id: g.id,
      slug: g.slug,
      topicTitle: g.topicTitle,
      summary: g.summary,
      estimatedMinutes: g.estimatedMinutes,
      completed: false,
      ready: true,
      prereqs: [],
    }));
    return NextResponse.json({ cards, mode: 'frontier' } satisfies GuideRecommendResponse);
  }

  const matches = await searchGuidesForChat(tokenize(q), MAX_CARDS);
  const cards: GuideRecommendCard[] = [];
  for (const match of matches) {
    const walkthrough = await getWalkthrough(match.id, userId);
    const nodes = walkthrough?.nodes ?? [];
    const prereqs = nodes
      .filter((n) => n.id !== match.id && n.status === 'published' && !n.completed)
      .sort((a, b) => a.level - b.level)
      .map((n) => ({ id: n.id, slug: n.slug, topicTitle: n.topicTitle }));
    const completed = nodes.find((n) => n.id === match.id)?.completed ?? false;
    cards.push({
      id: match.id,
      slug: match.slug,
      topicTitle: match.topicTitle,
      summary: match.summary,
      estimatedMinutes: match.estimatedMinutes,
      completed,
      ready: !completed && prereqs.length === 0,
      prereqs,
    });
  }
  return NextResponse.json({ cards, mode: 'search' } satisfies GuideRecommendResponse);
}
