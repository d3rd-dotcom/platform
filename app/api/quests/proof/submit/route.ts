import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureQuestProofSubmissionsSchema } from '@/lib/ensureQuestProofSubmissionsSchema';
import { getQuestDefinition } from '@/lib/quest-definitions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROOF_MIN = 10;
const PROOF_MAX = 4000;

interface SubmissionRow {
  id: string;
  status: string;
  note: string | null;
  proof_text: string | null;
  proof_url: string | null;
}

function cleanUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.slice(0, 1000);
}

async function loadSubmission(userId: string, questId: string): Promise<SubmissionRow | null> {
  const rows = await sqlQuery<SubmissionRow[]>(
    `SELECT id, status, note, proof_text, proof_url
     FROM quest_proof_submissions
     WHERE user_id = :userId AND quest_id = :questId
     LIMIT 1`,
    { userId, questId },
  );
  return rows[0] ?? null;
}

/**
 * GET /api/quests/proof/submit?questId=...
 * Returns the caller's proof-submission state for a quest.
 */
export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const questId = new URL(request.url).searchParams.get('questId');
  if (!questId) {
    return NextResponse.json({ error: 'questId is required.' }, { status: 400 });
  }

  const definition = getQuestDefinition(questId);
  if (!definition || definition.questType !== 'proof-required') {
    return NextResponse.json({ submission: null });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  await ensureQuestProofSubmissionsSchema();

  const submission = await loadSubmission(user.id, questId);
  return NextResponse.json({
    submission: submission
      ? {
          status: submission.status,
          note: submission.note,
          proofText: submission.proof_text,
          proofUrl: submission.proof_url,
        }
      : null,
  });
}

/**
 * POST /api/quests/proof/submit  { questId, proofText }
 * Files a proof submission (the member's written entry or a link) for staff
 * review. No diamonds are minted here — they are only awarded when a staff
 * member approves the submission via /api/quests/proof/review.
 */
export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const questId = typeof body?.questId === 'string' ? body.questId : null;
  const proofText = typeof body?.proofText === 'string' ? body.proofText.trim() : '';
  const proofUrl = cleanUrl(body?.proofUrl);
  if (!questId) {
    return NextResponse.json({ error: 'questId is required.' }, { status: 400 });
  }
  // Proof must be a written entry/link OR an attached file (or both).
  if (proofText.length < PROOF_MIN && !proofUrl) {
    return NextResponse.json(
      { error: `Share your work — write an entry, paste a link, or attach a file.` },
      { status: 400 },
    );
  }
  const proof = proofText.slice(0, PROOF_MAX);

  const definition = getQuestDefinition(questId);
  if (!definition || definition.questType !== 'proof-required') {
    return NextResponse.json({ error: 'This quest does not accept proof submissions.' }, { status: 400 });
  }

  await ensureQuestProofSubmissionsSchema();

  const existing = await loadSubmission(user.id, questId);
  if (existing) {
    if (existing.status === 'rejected') {
      // Let the member resubmit after a rejection.
      await sqlQuery(
        `UPDATE quest_proof_submissions
         SET status = 'pending', proof_text = :proof, proof_url = :proofUrl, note = NULL,
             reviewed_by = NULL, updated_at = NOW()
         WHERE user_id = :userId AND quest_id = :questId`,
        { userId: user.id, questId, proof, proofUrl },
      );
      return NextResponse.json({ ok: true, submission: { status: 'pending' } });
    }
    return NextResponse.json(
      { error: 'You already submitted this quest for review.', submission: { status: existing.status } },
      { status: 409 },
    );
  }

  try {
    await sqlQuery(
      `INSERT INTO quest_proof_submissions (id, user_id, quest_id, shards, proof_text, proof_url, status)
       VALUES (:id, :userId, :questId, :shards, :proof, :proofUrl, 'pending')`,
      {
        id: uuidv4(),
        userId: user.id,
        questId,
        shards: definition.points,
        proof,
        proofUrl,
      },
    );
  } catch (err: any) {
    if (String(err?.message || '').includes('uq_quest_proof_user_quest')) {
      return NextResponse.json(
        { error: 'You already submitted this quest for review.', submission: { status: 'pending' } },
        { status: 409 },
      );
    }
    console.error('Error creating proof submission:', err);
    return NextResponse.json({ error: 'Failed to submit quest.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, submission: { status: 'pending' } });
}
