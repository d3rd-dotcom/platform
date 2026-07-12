import { NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { ensureForumSchema } from '@/lib/ensureForumSchema';
import { ensureCustomQuestsSchema } from '@/lib/ensureCustomQuestsSchema';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { walletHasMembershipAccess } from '@/lib/membership-access';
import { getBlueWalletAddress } from '@/lib/blue-membership';
import { BASE_CHAIN_ID, USDC_ADDRESS } from '@/lib/crypto-payment';
import {
  FORGE_LIMITS,
  FORGE_TYPES,
  isRewardKind,
  usdcToUnits,
  validateReward,
  type RewardKind,
} from '@/lib/quest-forge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TYPES = FORGE_TYPES;
const MAX_TITLE_LEN = FORGE_LIMITS.titleMax;
const MAX_DESC_LEN = FORGE_LIMITS.descMax;

interface CustomQuestRow {
  id: string;
  title: string;
  description: string;
  points: number;
  quest_type: string;
  target_count: number;
  created_by: string;
  creator_wallet: string;
  creator_handle: string | null;
  assignee_wallet: string | null;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  reward_kind: string | null;
  reward_amount: string | null;
  escrow_total: string | null;
  escrow_remaining: string | null;
  escrow_status: string | null;
  funding_tx_hash: string | null;
}

function rowToJson(row: CustomQuestRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    points: row.points,
    questType: row.quest_type,
    targetCount: row.target_count,
    createdBy: row.created_by,
    creatorWallet: row.creator_wallet,
    creatorHandle: row.creator_handle,
    assigneeWallet: row.assignee_wallet,
    expiresAt: row.expires_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    rewardKind: (row.reward_kind ?? 'credits') as RewardKind,
    rewardAmount: row.reward_amount != null ? Number(row.reward_amount) : row.points,
    escrowTotal: row.escrow_total != null ? Number(row.escrow_total) : null,
    escrowRemaining: row.escrow_remaining != null ? Number(row.escrow_remaining) : null,
    escrowStatus: row.escrow_status ?? 'funded',
    fundingTxHash: row.funding_tx_hash,
  };
}

const ROW_COLUMNS = `id, title, description, points, quest_type, target_count, created_by,
       creator_wallet, creator_handle, assignee_wallet, expires_at, archived_at, created_at,
       reward_kind, reward_amount, escrow_total, escrow_remaining, escrow_status, funding_tx_hash`;

export async function GET(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  await ensureForumSchema();
  await ensureCustomQuestsSchema();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const url = new URL(request.url);
  const mine = url.searchParams.get('mine') === 'true';

  if (mine) {
    const rows = await sqlQuery<CustomQuestRow[]>(
      `SELECT ${ROW_COLUMNS}
       FROM custom_quests
       WHERE created_by = :userId AND archived_at IS NULL
       ORDER BY created_at DESC`,
      { userId: user.id }
    );
    return NextResponse.json({ quests: rows.map(rowToJson) });
  }

  return NextResponse.json({ error: 'Specify ?mine=true' }, { status: 400 });
}

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database is not configured.' }, { status: 503 });
  }

  await ensureForumSchema();
  await ensureCustomQuestsSchema();

  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const hasMembership = await walletHasMembershipAccess(user.walletAddress);
  if (!hasMembership) {
    return NextResponse.json(
      { error: 'A membership NFT is required to author quests.' },
      { status: 403 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  const description = typeof body?.description === 'string' ? body.description.trim() : '';
  const questType = typeof body?.questType === 'string' ? body.questType : 'no-proof';
  const targetCount = Number.isFinite(Number(body?.targetCount)) ? Math.round(Number(body.targetCount)) : 1;
  const assigneeWalletRaw = typeof body?.assigneeWallet === 'string' ? body.assigneeWallet.trim() : '';
  const expiresAtRaw = typeof body?.expiresAt === 'string' ? body.expiresAt.trim() : '';

  // Reward: 'credits' (default, and the legacy shape used `points`) or 'usdc'.
  const rewardKind: RewardKind = isRewardKind(body?.rewardKind) ? body.rewardKind : 'credits';
  const legacyPoints = Number.isFinite(Number(body?.points)) ? Math.round(Number(body.points)) : 50;
  const rawRewardAmount = body?.rewardAmount != null
    ? Number(body.rewardAmount)
    : (rewardKind === 'credits' ? legacyPoints : NaN);

  if (!title || title.length > MAX_TITLE_LEN) {
    return NextResponse.json({ error: `Title must be 1–${MAX_TITLE_LEN} characters.` }, { status: 400 });
  }
  if (!description || description.length > MAX_DESC_LEN) {
    return NextResponse.json({ error: `Description must be 1–${MAX_DESC_LEN} characters.` }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(questType as any)) {
    return NextResponse.json({ error: 'Invalid quest type.' }, { status: 400 });
  }
  if (!Number.isFinite(targetCount) || targetCount < FORGE_LIMITS.targetMin || targetCount > FORGE_LIMITS.targetMax) {
    return NextResponse.json({ error: `Target count must be between ${FORGE_LIMITS.targetMin} and ${FORGE_LIMITS.targetMax}.` }, { status: 400 });
  }

  const reward = validateReward(rewardKind, rawRewardAmount, targetCount);
  if (!reward.ok) {
    return NextResponse.json({ error: reward.error }, { status: 400 });
  }

  let assigneeWallet: string | null = null;
  if (assigneeWalletRaw) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(assigneeWalletRaw)) {
      return NextResponse.json({ error: 'Assignee must be a valid 0x wallet.' }, { status: 400 });
    }
    assigneeWallet = assigneeWalletRaw.toLowerCase();
  }

  let expiresAt: string | null = null;
  if (expiresAtRaw) {
    const parsed = new Date(expiresAtRaw);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: 'Expiry date is invalid.' }, { status: 400 });
    }
    if (parsed.getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'Expiry must be in the future.' }, { status: 400 });
    }
    expiresAt = parsed.toISOString();
  }

  const id = `cq_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
  // For credits the reward IS the points value; USDC quests grant no credits.
  const points = rewardKind === 'credits' ? reward.amount : 0;
  // USDC quests stay hidden until the creator funds the escrow on-chain.
  const escrowStatus = 'pending_funding';

  const insertParams = {
    id,
    title,
    description,
    points,
    questType,
    targetCount,
    createdBy: user.id,
    creatorWallet: user.walletAddress.toLowerCase(),
    creatorHandle: user.username ?? null,
    assigneeWallet,
    expiresAt,
    rewardKind,
    rewardAmount: reward.amount,
    escrowTotal: reward.escrowTotal,
    escrowStatus,
  };

  const insertSql = `INSERT INTO custom_quests
       (id, title, description, points, quest_type, target_count, created_by,
        creator_wallet, creator_handle, assignee_wallet, expires_at,
        reward_kind, reward_amount, escrow_total, escrow_remaining, escrow_status)
     VALUES
       (:id, :title, :description, :points, :questType, :targetCount, :createdBy,
        :creatorWallet, :creatorHandle, :assigneeWallet, :expiresAt,
        :rewardKind, :rewardAmount, :escrowTotal, :escrowTotal, :escrowStatus)`;

  // Both reward kinds are escrowed onchain now: the quest is created unfunded
  // and stays hidden until the creator's deposit to Blue's wallet is verified
  // by /api/quests/forge/confirm-funding — $BLUE for credit quests, USDC for
  // USDC quests. No server-side balance is ever debited.
  await sqlQuery(insertSql, insertParams);

  const rows = await sqlQuery<CustomQuestRow[]>(
    `SELECT ${ROW_COLUMNS} FROM custom_quests WHERE id = :id LIMIT 1`,
    { id }
  );
  const quest = rows[0] ? rowToJson(rows[0]) : null;

  // Every quest needs an onchain deposit to Blue before it goes live. Hand the
  // client everything it needs to send that transfer; /api/quests/forge/
  // confirm-funding verifies it and flips the quest to 'funded'.
  let blueWallet: string | null = null;
  try {
    blueWallet = getBlueWalletAddress();
  } catch (err) {
    console.error('[quests] Blue wallet not configured for escrow:', err);
  }
  return NextResponse.json(
    {
      quest,
      funding: blueWallet
        ? rewardKind === 'usdc'
          ? {
              kind: 'usdc',
              blueWallet,
              usdcAddress: USDC_ADDRESS,
              chainId: BASE_CHAIN_ID,
              amount: usdcToUnits(reward.escrowTotal),
              amountDisplay: reward.escrowTotal,
            }
          : {
              kind: 'credits',
              blueWallet,
              amountDisplay: reward.escrowTotal,
            }
        : null,
    },
    { status: 201 },
  );
}
