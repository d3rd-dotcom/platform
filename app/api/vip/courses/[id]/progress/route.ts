import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getVipCourseFull, getVipProgress, upsertVipProgress } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const progress = await getVipProgress(user.id, params.id);
  return NextResponse.json({ progress });
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json();
  const { weekId, completedComponentIds, componentData, isSealed } = body;

  if (!weekId) {
    return NextResponse.json({ error: 'Missing weekId.' }, { status: 400 });
  }

  // The quiz: namespace in component_data is server-owned — it records graded
  // attempts written by the quiz-grade endpoint and must not be client-set.
  let safeComponentData = componentData;
  if (componentData && typeof componentData === 'object' && !Array.isArray(componentData)) {
    safeComponentData = Object.fromEntries(
      Object.entries(componentData as Record<string, unknown>).filter(([key]) => !key.startsWith('quiz:')),
    );
  }

  // Quiz tasks can only be marked complete after a passed, server-graded attempt.
  if (Array.isArray(completedComponentIds) && completedComponentIds.length > 0) {
    const course = await getVipCourseFull(params.id);
    const week = course?.weeks.find((w) => w.id === weekId);
    if (!course || !week) {
      return NextResponse.json({ error: 'Week not found.' }, { status: 404 });
    }

    const quizIds = new Map<string, string>();
    for (const comp of week.components) {
      if (comp.componentType === 'quiz_block') {
        quizIds.set(comp.id, comp.title || 'this quiz');
      }
      if (comp.componentType === 'mission_container') {
        for (const block of comp.blocks ?? []) {
          if (block.blockType === 'quiz_block') quizIds.set(block.id, comp.title || 'this mission');
        }
      }
    }

    if (quizIds.size > 0) {
      const rows = await getVipProgress(user.id, params.id);
      const existing = rows.find((p) => p.weekId === weekId);
      const alreadyCompleted = new Set(existing?.completedComponentIds ?? []);
      const attempts = existing?.componentData ?? {};
      for (const id of completedComponentIds as string[]) {
        if (alreadyCompleted.has(id) || !quizIds.has(id)) continue;
        const attempt = attempts[`quiz:${id}`] as { passed?: boolean } | undefined;
        if (attempt?.passed !== true) {
          return NextResponse.json(
            { error: `Pass the quiz in "${quizIds.get(id)}" before completing it.` },
            { status: 400 },
          );
        }
      }
    }
  }

  const record = await upsertVipProgress(user.id, params.id, weekId, {
    completedComponentIds,
    componentData: safeComponentData,
    isSealed,
  });

  return NextResponse.json({ progress: record });
}
