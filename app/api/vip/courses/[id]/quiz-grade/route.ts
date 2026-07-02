import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured } from '@/lib/db';
import { getVipCourseFull, getVipProgress, upsertVipProgress } from '@/lib/vip-course-db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PASSING_SCORE = 60;

interface QuizOption { id: string; text: string; isCorrect?: boolean }
interface QuizQuestion { id: string; text: string; options?: QuizOption[] }

export async function POST(request: Request, { params }: { params: { id: string } }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const blockId = body.blockId;
  const answers = body.answers;
  if (!blockId || typeof blockId !== 'string') {
    return NextResponse.json({ error: 'Missing blockId.' }, { status: 400 });
  }
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return NextResponse.json({ error: 'Missing answers.' }, { status: 400 });
  }

  const course = await getVipCourseFull(params.id);
  if (!course) {
    return NextResponse.json({ error: 'Course not found.' }, { status: 404 });
  }

  // Locate the quiz — either a block inside a mission or a legacy component.
  let quizConfig: Record<string, unknown> | undefined;
  let weekId: string | undefined;
  for (const week of course.weeks) {
    for (const comp of week.components) {
      if (comp.componentType === 'quiz_block' && comp.id === blockId) {
        quizConfig = comp.config;
        weekId = week.id;
        break;
      }
      const block = (comp.blocks ?? []).find((b) => b.id === blockId && b.blockType === 'quiz_block');
      if (block) {
        quizConfig = block.config;
        weekId = week.id;
        break;
      }
    }
    if (quizConfig) break;
  }
  if (!quizConfig || !weekId) {
    return NextResponse.json({ error: 'Quiz not found in this course.' }, { status: 404 });
  }

  const questions = (quizConfig.questions as QuizQuestion[] | undefined) ?? [];
  if (questions.length === 0) {
    return NextResponse.json({ error: 'Quiz has no questions.' }, { status: 400 });
  }

  const results: Record<string, boolean> = {};
  let correctCount = 0;
  for (const q of questions) {
    const raw = (answers as Record<string, unknown>)[q.id];
    const selected = Array.isArray(raw) ? raw.map(String).sort() : [];
    const correct = (q.options ?? []).filter((o) => o.isCorrect).map((o) => o.id).sort();
    const ok = correct.length > 0
      && selected.length === correct.length
      && selected.every((v, i) => v === correct[i]);
    results[q.id] = ok;
    if (ok) correctCount++;
  }

  const total = questions.length;
  const score = Math.round((correctCount / total) * 100);
  const passingScore = typeof quizConfig.passingScore === 'number' ? quizConfig.passingScore : DEFAULT_PASSING_SCORE;
  const passedNow = score >= passingScore;

  // Passing is sticky — a later failed retake doesn't take completion away.
  const progressRows = await getVipProgress(user.id, params.id);
  const existing = progressRows.find((p) => p.weekId === weekId);
  const prev = existing?.componentData?.[`quiz:${blockId}`] as { passed?: boolean; score?: number } | undefined;
  const passed = passedNow || prev?.passed === true;
  const bestScore = Math.max(score, typeof prev?.score === 'number' ? prev.score : 0);

  await upsertVipProgress(user.id, params.id, weekId, {
    componentData: {
      [`quiz:${blockId}`]: {
        passed,
        score: bestScore,
        lastScore: score,
        correctCount,
        total,
        answeredAt: new Date().toISOString(),
      },
    },
  });

  return NextResponse.json({ score, correctCount, total, passed, passingScore, results });
}
