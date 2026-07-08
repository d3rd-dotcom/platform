import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensurePrayersSchema } from '@/lib/ensurePrayersSchema';
import { decryptForUser } from '@/lib/encrypt';
import { verifyDiamondBurnTx, recordDiamondBurn, TX_HASH_PATTERN } from '@/lib/diamond-burns';
import { checkRateLimit, getRateLimitHeaders } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UNSEAL_DIAMOND_COST = 400;

interface FieldNoteEntry {
  day?: number;
  date?: string;
  content?: string;
  submittedAt?: number;
}

interface UnsealedNote {
  date: string;
  content: string;
  day: number;
  weekNumber: number;
  submittedAt: number | null;
}

function parseAllWeekPages(userId: string, progressData: any): Record<string, FieldNoteEntry[]> {
  if (progressData?.encrypted && progressData?.data) {
    const decrypted = decryptForUser(userId, progressData.data);
    const parsed = JSON.parse(decrypted);
    return parsed.allWeekPages ?? {};
  }

  return progressData?.allWeekPages ?? {};
}

function flattenNotes(allWeekPages: Record<string, FieldNoteEntry[]>): UnsealedNote[] {
  const notes: UnsealedNote[] = [];

  for (const [weekKey, entries] of Object.entries(allWeekPages)) {
    if (!Array.isArray(entries)) continue;
    const weekNumber = Number(weekKey);

    for (const entry of entries) {
      if (typeof entry?.date !== 'string') continue;
      if (typeof entry.content !== 'string' || entry.content.trim().length === 0) continue;

      notes.push({
        date: entry.date,
        content: entry.content,
        day: typeof entry.day === 'number' ? entry.day : 0,
        weekNumber: Number.isFinite(weekNumber) ? weekNumber : 0,
        submittedAt: typeof entry.submittedAt === 'number' ? entry.submittedAt : null,
      });
    }
  }

  notes.sort((a, b) => a.date.localeCompare(b.date));
  return notes;
}

/**
 * POST /api/daily-notes/unseal
 * Body: { txHash } — the hash of a confirmed 400 $BLUE burn (transfer to the
 * dead address on Base) signed by the user's wallet. Verifies the burn
 * on-chain, records it (one unseal per tx hash), and returns every field
 * note the user has written, oldest first. Access lasts for the current
 * view only — the client re-seals on close and a new unseal burns again.
 */
export async function POST(request: NextRequest) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rl = checkRateLimit({
    max: 10,
    windowMs: 60 * 60 * 1000,
    identifier: `daily-note-unseal:${user.id}`,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: { txHash?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const txHash = body.txHash?.trim();
  if (!txHash || !TX_HASH_PATTERN.test(txHash)) {
    return NextResponse.json({ error: 'invalid_tx', cost: UNSEAL_DIAMOND_COST }, { status: 400 });
  }

  await ensurePrayersSchema();

  const rows = await sqlQuery<Array<{ progress_data: any }>>(
    `SELECT progress_data FROM prayers
     WHERE user_id = :userId
     LIMIT 1`,
    { userId: user.id }
  );

  let notes: UnsealedNote[] = [];
  if (rows.length > 0) {
    try {
      notes = flattenNotes(parseAllWeekPages(user.id, rows[0].progress_data));
    } catch (error) {
      console.error('Failed to decrypt field notes for unseal:', error);
      return NextResponse.json({ error: 'Failed to load notes.' }, { status: 500 });
    }
  }

  if (notes.length === 0) {
    return NextResponse.json({ error: 'no_notes' }, { status: 404 });
  }

  let verification;
  try {
    verification = await verifyDiamondBurnTx(txHash, user.walletAddress, UNSEAL_DIAMOND_COST);
  } catch (error) {
    console.error('Burn verification failed:', error);
    return NextResponse.json({ error: 'verify_failed' }, { status: 502 });
  }

  if (!verification.ok) {
    return NextResponse.json(
      { error: 'burn_not_verified', reason: verification.reason, cost: UNSEAL_DIAMOND_COST },
      { status: 402 }
    );
  }

  // One unseal per burn tx — the unique constraint rejects replays.
  const recorded = await recordDiamondBurn({
    userId: user.id,
    walletAddress: user.walletAddress,
    purpose: 'field_notes_unseal',
    amount: UNSEAL_DIAMOND_COST,
    txHash,
  });
  if (!recorded) {
    return NextResponse.json({ error: 'tx_already_used' }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    notes,
    diamondsBurned: UNSEAL_DIAMOND_COST,
  });
}
