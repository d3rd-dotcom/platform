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

  const body = await request.json().catch(() => null) as {
    weekId?: unknown;
    completedComponentIds?: unknown;
    componentData?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  const { weekId, completedComponentIds, componentData } = body;

  if (typeof weekId !== 'string' || !weekId) {
    return NextResponse.json({ error: 'Missing weekId.' }, { status: 400 });
  }
  if (
    completedComponentIds !== undefined
    && (!Array.isArray(completedComponentIds)
      || !completedComponentIds.every((id) => typeof id === 'string'))
  ) {
    return NextResponse.json(
      { error: 'completedComponentIds must be a string array.' },
      { status: 400 },
    );
  }
  if (
    componentData !== undefined
    && (typeof componentData !== 'object' || componentData === null || Array.isArray(componentData))
  ) {
    return NextResponse.json({ error: 'componentData must be an object.' }, { status: 400 });
  }

  // The quiz: namespace in component_data is server-owned — it records graded
  // attempts written by the quiz-grade endpoint and must not be client-set.
  const safeComponentData = componentData
    ? Object.fromEntries(
        Object.entries(componentData).filter(([key]) => !key.startsWith('quiz:')),
      )
    : undefined;

  const course = await getVipCourseFull(params.id);
  const week = course?.weeks.find((entry) => entry.id === weekId);
  if (!course || !week) {
    return NextResponse.json({ error: 'Week not found.' }, { status: 404 });
  }

  // Quiz tasks can only be marked complete after a passed, server-graded attempt.
  if (completedComponentIds && completedComponentIds.length > 0) {
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
      for (const id of completedComponentIds) {
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
  });

  return NextResponse.json({ progress: record });
}
