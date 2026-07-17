import { NextResponse } from 'next/server';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureWeeksSchema } from '@/lib/ensureWeeksSchema';
import { ensureCustomQuestsSchema } from '@/lib/ensureCustomQuestsSchema';
import { ensurePrayersSchema } from '@/lib/ensurePrayersSchema';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { recordBlueQuestCompletion } from '@/lib/blue-memory';
import { postSystemMessage } from '@/lib/chat';
import { isDbConfigured, sqlQuery, withTransaction, sqlQueryWithClient } from '@/lib/db';
import { getQuestDefinition, getQuestDefinitionForStoredQuestId } from '@/lib/quest-definitions';
import { ensureQuestUsdcClaimsSchema } from '@/lib/ensureQuestUsdcClaimsSchema';
import { isOwnStorageUrl } from '@/lib/supabase-storage';
import { recordAgentActivity } from '@/lib/room-log';
import { deliverDiamondsOnchain } from '@/lib/diamonds-onchain';
import {
  parseBalloonMilestone,
  parseDailyNoteQuestId,
} from '@/lib/quest-reward-verification';
import { v4 as uuidv4 } from 'uuid';

interface CustomQuestRow {
  id: string;
  points: number;
  target_count: number;
  quest_type: string;
  assignee_wallet: string | null;
  archived_at: string | null;
  expires_at: string | null;
  reward_kind: string | null;
  reward_amount: string | null;
  escrow_remaining: string | null;
  escrow_status: string | null;
}

async function loadCustomQuest(questId: string): Promise<CustomQuestRow | null> {
  const baseId = questId.replace(/-\d+$/, '');
  if (!/^cq_[a-f0-9]+$/i.test(baseId)) return null;
  const rows = await sqlQuery<CustomQuestRow[]>(
    `SELECT id, points, target_count, quest_type, assignee_wallet, archived_at, expires_at,
            reward_kind, reward_amount, escrow_remaining, escrow_status
     FROM custom_quests WHERE id = :id LIMIT 1`,
    { id: baseId }
  );
  return rows[0] ?? null;
}

async function verifyFixedQuestState(
  questId: string,
  user: { id: string; walletAddress: string },
): Promise<boolean> {
  switch (questId) {
    case 'connect-wallet':
      return /^0x[a-fA-F0-9]{40}$/.test(user.walletAddress);
    case 'complete-profile': {
      const rows = await sqlQuery<Array<{ complete: boolean }>>(
         `SELECT (
           username IS NOT NULL
           AND LEFT(username, 5) <> 'user_'
           AND selected_avatar_id IS NOT NULL
           AND gender IS NOT NULL
           AND birthday IS NOT NULL
         ) AS complete
         FROM users WHERE id = :userId LIMIT 1`,
        { userId: user.id },
      );
      return rows[0]?.complete === true;
    }
    case 'first-reading': {
      const rows = await sqlQuery<Array<{ complete: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM weeks
           WHERE user_id = :userId
             AND jsonb_array_length(COALESCE(credited_sections, '[]'::jsonb)) > 0
         ) AS complete`,
        { userId: user.id },
      );
      return rows[0]?.complete === true;
    }
    case 'first-journal': {
      await ensurePrayersSchema();
      const rows = await sqlQuery<Array<{ complete: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM daily_note_completions WHERE user_id = :userId
         ) AS complete`,
        { userId: user.id },
      );
      return rows[0]?.complete === true;
    }
    case 'week-1-story-checkin': {
      // The story has no server-owned playback ledger. A sealed Week 1 is the
      // authoritative end-of-week state that makes this check-in claimable.
      const rows = await sqlQuery<Array<{ complete: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM weeks
           WHERE user_id = :userId AND week_number = 1 AND is_sealed = true
         ) AS complete`,
        { userId: user.id },
      );
      return rows[0]?.complete === true;
    }
    // These legacy rewards have no trustworthy server-side completion ledger.
    // Keep them closed until their originating feature records authoritative
    // state. Proposal/voting paths are dormant and intentionally untouched.
    case 'daily-checkin':
    case 'first-proposal':
    case 'first-vote':
    default:
      return false;
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Server-side quest reward definitions — client values are IGNORED
const QUEST_REWARDS: Record<string, number> = {
  'twitter-follow-quest': 10,
  'daily-checkin': 5,
  'first-proposal': 50,
  'first-vote': 25,
  'connect-wallet': 10,
  'complete-profile': 15,
  'first-reading': 20,
  'first-journal': 20,
  'week-1-story-checkin': 50,
};

// Daily notes quests follow pattern: daily-notes-w{week}-d{day}
function getQuestShardReward(questId: string): number {
  const definition = getQuestDefinitionForStoredQuestId(questId);
  if (definition) {
    return definition.points;
  }
  if (QUEST_REWARDS[questId] !== undefined) {
    return QUEST_REWARDS[questId];
  }
  // Daily notes quests: daily-notes-w1-d1, daily-notes-w2-d3, etc.
  if (/^daily-notes-w\d+-d\d+$/.test(questId)) {
    return 100;
  }
  // Balloon pop milestones: balloon-5, balloon-10, balloon-15, etc.
  if (/^balloon-\d+$/.test(questId)) {
    return 10;
  }
  // Generic quest reward fallback (capped at safe default)
  return 10;
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json(
      { error: 'Database is not configured on the server.' },
      { status: 503 }
    );
  }
  await ensureForumSchema();
  await ensureWeeksSchema();
  await ensureCustomQuestsSchema();

  // Get our internal user record (authenticated via wallet address)
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const questId = body?.questId;
  const proofText = typeof body?.proofText === 'string' ? body.proofText.trim().slice(0, 4000) : '';
  // SECURITY: only our own Storage uploads are accepted as attachments — never
  // an arbitrary member-supplied link (phishing/drainer vector for reviewers).
  const rawProofUrl = typeof body?.proofUrl === 'string' ? body.proofUrl.trim() : '';
  if (rawProofUrl && !isOwnStorageUrl(rawProofUrl)) {
    return NextResponse.json(
      { error: 'Attach files through the uploader — external links are not accepted.' },
      { status: 400 },
    );
  }
  const proofUrl = rawProofUrl || null;

  if (!questId || typeof questId !== 'string') {
    return NextResponse.json({ error: 'Quest ID is required.' }, { status: 400 });
  }

  // SECURITY: Credit reward determined server-side; client value is ignored.
  const definition = getQuestDefinition(questId);
  const customQuest = definition ? null : await loadCustomQuest(questId);

  // SECURITY: only known quests pay out. The old generic 10-diamond fallback
  // let any invented questId string mint credits (and, now that rewards are
  // delivered onchain, drain real $BLUE from Blue's stash) without limit.
  const dailyNoteCoordinates = parseDailyNoteQuestId(questId);
  const balloonCount = parseBalloonMilestone(questId);
  const isDailyNoteQuest = dailyNoteCoordinates !== null;
  const isBalloonQuest = balloonCount !== null;
  const isKnownFixedQuest = QUEST_REWARDS[questId] !== undefined;
  if (!definition && !customQuest && !isKnownFixedQuest && !isDailyNoteQuest && !isBalloonQuest) {
    return NextResponse.json({ error: 'Unknown quest.' }, { status: 404 });
  }

  // SECURITY: proof-required quests can NEVER be self-attested here — that would
  // let anyone mint the diamonds without ever submitting proof. They go through
  // /api/quests/proof/submit and are only awarded on staff approval.
  if (definition?.questType === 'proof-required') {
    return NextResponse.json(
      { error: 'Proof quests are reviewed before diamonds are released. Submit your proof and a staff member will approve it.' },
      { status: 400 },
    );
  }

  // Follow rewards are awarded only by the server-side X verification route.
  if (definition?.questType === 'twitter-follow' || questId === 'twitter-follow-quest') {
    return NextResponse.json(
      { error: 'Verify your X follow before claiming this quest.' },
      { status: 400 },
    );
  }

  // Catalog quests require authoritative completion state. Definitions with
  // dedicated verifiers continue below; generic no-proof entries remain
  // unavailable until their originating feature records completion.
  if (definition?.questType === 'no-proof') {
    return NextResponse.json(
      { error: 'This quest is awaiting a verified completion record.' },
      { status: 409 },
    );
  }

  if (isDailyNoteQuest) {
    await ensurePrayersSchema();
    const rows = await sqlQuery<Array<{ complete: boolean }>>(
      `SELECT EXISTS (
         SELECT 1 FROM daily_note_completions
         WHERE user_id = :userId AND week_number = :week AND day_number = :day
       ) AS complete`,
      { userId: user.id, week: dailyNoteCoordinates.week, day: dailyNoteCoordinates.day },
    );
    if (rows[0]?.complete !== true) {
      return NextResponse.json(
        { error: 'Save this field note before claiming its reward.' },
        { status: 409 },
      );
    }
  }

  if (isBalloonQuest) {
    // A pop is a browser interaction. Even one authenticated request per pop
    // can be scripted, so the counter cannot authorize real credits or an
    // onchain transfer. Keep this legacy reward closed until there is a
    // tamper-resistant challenge or another authoritative achievement source.
    return NextResponse.json(
      { error: 'Balloon rewards are temporarily unavailable.' },
      { status: 409 },
    );
  }

  if (isKnownFixedQuest && questId !== 'twitter-follow-quest') {
    if (!(await verifyFixedQuestState(questId, user))) {
      return NextResponse.json(
        { error: 'Your completion record is still missing.' },
        { status: 409 },
      );
    }
  }

  if (!definition && customQuest) {
    if (customQuest.archived_at) {
      return NextResponse.json({ error: 'Quest is no longer available.' }, { status: 410 });
    }
    if (customQuest.expires_at && new Date(customQuest.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Quest has expired.' }, { status: 410 });
    }
    if (
      customQuest.assignee_wallet &&
      customQuest.assignee_wallet.toLowerCase() !== user.walletAddress.toLowerCase()
    ) {
      return NextResponse.json({ error: 'Quest is not assigned to you.' }, { status: 403 });
    }
  }

  // Every custom quest needs creator approval before escrow is released. The
  // no-proof label controls the submission form, while the creator supplies
  // the authoritative completion decision.
  if (customQuest) {
    const isUsdc = customQuest.reward_kind === 'usdc';

    // Proof quests must carry the member's entry/link/file so the creator can judge it.
    if (customQuest.quest_type === 'proof-required' && proofText.length < 10 && !proofUrl) {
      return NextResponse.json(
        { error: 'Share your work — write an entry, paste a link, or attach a file.' },
        { status: 400 },
      );
    }

    if (customQuest.escrow_status !== 'funded') {
      return NextResponse.json({ error: 'This quest is not funded yet.' }, { status: 409 });
    }
    // Only USDC payouts need a destination wallet; credit rewards land in-app.
    if (isUsdc && !user.walletAddress) {
      return NextResponse.json({ error: 'Link a wallet to receive USDC.' }, { status: 400 });
    }
    const rewardAmount = Number(customQuest.reward_amount ?? customQuest.points ?? 0);
    if (!(rewardAmount > 0)) {
      return NextResponse.json({ error: 'This quest has no reward configured.' }, { status: 400 });
    }

    await ensureQuestUsdcClaimsSchema();

    // Cap outstanding + paid claims at the target so a public quest can't
    // amass more pending claims than its escrow could ever cover.
    const activeClaims = await sqlQuery<Array<{ n: string }>>(
      `SELECT COUNT(*)::text AS n FROM quest_usdc_claims
       WHERE quest_id = :qid AND status <> 'rejected'`,
      { qid: customQuest.id },
    );
    if (Number(activeClaims[0]?.n ?? 0) >= customQuest.target_count) {
      return NextResponse.json({ error: 'All reward slots for this quest are taken.' }, { status: 409 });
    }

    try {
      await sqlQuery(
        `INSERT INTO quest_usdc_claims (id, user_id, quest_id, recipient_wallet, usdc_amount, reward_kind, proof_text, proof_url, status)
         VALUES (:id, :userId, :questId, :wallet, :amount, :rewardKind, :proofText, :proofUrl, 'pending')`,
        {
          id: uuidv4(),
          userId: user.id,
          questId: customQuest.id,
          wallet: user.walletAddress ?? null,
          amount: rewardAmount,
          rewardKind: isUsdc ? 'usdc' : 'credits',
          proofText: proofText || null,
          proofUrl,
        },
      );
    } catch (err: any) {
      if (String(err?.message || '').includes('uq_quest_usdc_claim_user_quest')) {
        return NextResponse.json(
          { error: 'You already submitted this quest for review.', claim: { status: 'pending' } },
          { status: 409 },
        );
      }
      console.error('Error creating custom quest claim:', err);
      return NextResponse.json({ error: 'Failed to submit quest.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, status: 'pending_review', rewardKind: isUsdc ? 'usdc' : 'credits', rewardAmount });
  }

  try {
    if (definition?.questType === 'sealed-week') {
      const sealedRows = await sqlQuery<Array<{ is_sealed: boolean }>>(
        `SELECT is_sealed
         FROM weeks
         WHERE user_id = :userId AND week_number = :weekNumber
         LIMIT 1`,
        { userId: user.id, weekNumber: definition.weekNumber }
      );

      if (!sealedRows[0]?.is_sealed) {
        return NextResponse.json(
          { error: `Week ${definition.weekNumber} must be sealed on your home page before this quest can be claimed.` },
          { status: 400 }
        );
      }
    }

    let resolvedQuestId = questId;
    let shardsToAward = getQuestShardReward(questId);

    if (definition && definition.targetCount > 1) {
      const existingRows = await sqlQuery<Array<{ quest_id: string }>>(
        `SELECT quest_id
         FROM quests
         WHERE user_id = :userId`,
        { userId: user.id }
      );

      const completionCount = existingRows.filter((row) => {
        const matchedDefinition = getQuestDefinitionForStoredQuestId(row.quest_id);
        return matchedDefinition?.key === definition.key;
      }).length;

      if (completionCount >= definition.targetCount) {
        return NextResponse.json({ error: 'Quest already completed.' }, { status: 409 });
      }

      resolvedQuestId = `${definition.key}-${completionCount + 1}`;
      shardsToAward = getQuestShardReward(resolvedQuestId);
    }

    // Agents earn a quarter of the credits a human gets for the same task.
    if (user.accountType === 'agent') {
      shardsToAward = Math.floor(shardsToAward * 0.25);
    }

    // Check if quest already completed (outside transaction for early exit)
    const existingCompletion = await sqlQuery<Array<{ id: string }>>(
      `SELECT id FROM quests
       WHERE user_id = :userId AND quest_id = :questId
       LIMIT 1`,
      { userId: user.id, questId: resolvedQuestId }
    );

    if (existingCompletion.length > 0) {
      return NextResponse.json({ error: 'Quest already completed.' }, { status: 409 });
    }

    // Award credits, record completion, and fetch updated count atomically
    const { newShardCount, hasLinkedAccount } = await withTransaction(async (client) => {
      // Re-check inside transaction to prevent race conditions
      const dupeCheck = await sqlQueryWithClient<Array<{ id: string }>>(
        client,
        `SELECT id FROM quests
         WHERE user_id = :userId AND quest_id = :questId
         LIMIT 1`,
        { userId: user.id, questId: resolvedQuestId }
      );
      if (dupeCheck.length > 0) {
        throw new Error('QUEST_ALREADY_COMPLETED');
      }

      await sqlQueryWithClient(
        client,
        `UPDATE users
         SET shard_count = shard_count + :shards
         WHERE id = :id`,
        { id: user.id, shards: shardsToAward }
      );

      const completionId = uuidv4();
      await sqlQueryWithClient(
        client,
        `INSERT INTO quests (id, user_id, quest_id, shards_awarded)
         VALUES (:id, :userId, :questId, :shards)`,
        { id: completionId, userId: user.id, questId: resolvedQuestId, shards: shardsToAward }
      );

      const shardRows = await sqlQueryWithClient<Array<{ shard_count: number; wallet_address: string | null }>>(
        client,
        `SELECT shard_count, wallet_address FROM users WHERE id = :id LIMIT 1`,
        { id: user.id }
      );

      return {
        newShardCount: shardRows[0]?.shard_count ?? 0,
        hasLinkedAccount: !!shardRows[0]?.wallet_address,
      };
    });

    // Quest diamonds come from Blue herself — a p2p transfer out of her own
    // 200M $BLUE stash, not a mint (fail-soft, never blocks the completion).
    if (shardsToAward > 0) {
      await deliverDiamondsOnchain({
        userId: user.id,
        walletAddress: user.walletAddress,
        source: 'quest',
        refId: resolvedQuestId,
        amount: shardsToAward,
        delivery: 'blue_transfer',
      });
    }

    try {
      await recordBlueQuestCompletion({
        userId: user.id,
        questId: resolvedQuestId,
      });
    } catch (memoryError: unknown) {
      const message = memoryError instanceof Error ? memoryError.message : 'unknown blue quest memory error';
      console.error('Blue quest memory error:', message);
    }

    // Stream agent quest completions into the Room Log feed
    if (user.accountType === 'agent') {
      try {
        await recordAgentActivity(user.id, `${user.username} completed a quest (+${shardsToAward} credits).`);
      } catch (activityError: unknown) {
        console.error('Room Log activity error:', activityError);
      }
    }

    // Post to global chat
    try {
      if (/^balloon-\d+$/.test(resolvedQuestId)) {
        await postSystemMessage(
          user.id,
          user.username,
          user.avatarUrl,
          `${user.username} popped some balloons (+${shardsToAward} diamonds).`,
        );
      } else {
        const questName = definition?.title ?? 'a quest';
        await postSystemMessage(
          user.id,
          user.username,
          user.avatarUrl,
          `${user.username} completed ${questName} (+${shardsToAward} credits).`,
        );
      }
    } catch (chatError: unknown) {
      console.error('Global chat notification error:', chatError);
    }

    return NextResponse.json({
      ok: true,
      shardsAwarded: shardsToAward,
      newShardCount,
      requiresAccountLinking: !hasLinkedAccount,
    });
  } catch (err: any) {
    if (err.message === 'QUEST_ALREADY_COMPLETED') {
      return NextResponse.json({ error: 'Quest already completed.' }, { status: 409 });
    }
    console.error('Error completing quest:', err);
    return NextResponse.json({ error: 'Failed to complete quest.' }, { status: 500 });
  }
}
