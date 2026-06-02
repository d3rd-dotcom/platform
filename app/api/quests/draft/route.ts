import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { walletHoldsVipMembershipCard } from '@/lib/vip-membership-card';
import { elizaAPI } from '@/lib/eliza-api';
import {
  FORGE_LIMITS,
  FORGE_TYPES,
  isRewardKind,
  roundUsdc,
  type QuestForgeType,
  type RewardKind,
} from '@/lib/quest-forge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ELIZA_API_KEY = process.env.ELIZA_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const CHAT_MODEL = process.env.ELIZA_CHAT_MODEL || 'anthropic/claude-sonnet-4.6';

export interface QuestDraft {
  title: string;
  description: string;
  questType: QuestForgeType;
  rewardKind: RewardKind;
  rewardAmount: number;
  targetCount: number;
}

const DRAFT_SYSTEM_PROMPT = `You turn a member's plain-language request into a single structured community quest for Mental Wealth Academy. A quest is a short task other members complete to earn a reward the requester is funding.

Return ONLY raw JSON, no prose, in exactly this shape:
{"title":"string","description":"string","questType":"no-proof"|"proof-required","rewardKind":"credits"|"usdc","rewardAmount":number,"targetCount":number}

Rules:
- title: a short, concrete imperative (max 80 chars). No emojis, no quotes, no all-caps.
- description: 1-3 plain sentences telling the completer exactly what to do (max 600 chars).
- questType: "proof-required" if completion needs evidence (a screenshot, link, photo, written submission); otherwise "no-proof".
- rewardKind: "usdc" only if the user clearly means real money or dollars; otherwise "credits".
- rewardAmount: the reward PER completion. Credits are whole numbers ${FORGE_LIMITS.creditsMin}-${FORGE_LIMITS.creditsMax}. USDC is ${FORGE_LIMITS.usdcMin}-${FORGE_LIMITS.usdcMax} dollars. If the user gives no amount, use 50 credits.
- targetCount: how many completions are wanted, ${FORGE_LIMITS.targetMin}-${FORGE_LIMITS.targetMax}. Default 1.
- Never invent a USDC reward the user did not ask for. When in doubt, use credits.`;

function clampInt(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

/** Last-resort parser when no LLM is configured or the call fails. */
function heuristicDraft(prompt: string): QuestDraft {
  const text = prompt.trim();
  const lower = text.toLowerCase();

  const wantsUsdc = /\b(usdc|dollar|\$\s*\d|\d+\s*(?:bucks|usd))\b/.test(lower);
  const proof = /\b(proof|screenshot|photo|picture|link|submit|upload|evidence|show)\b/.test(lower);

  const firstSentence = text.split(/(?<=[.!?])\s/)[0] || text;
  const title = (firstSentence.length > 80 ? firstSentence.slice(0, 77) + '…' : firstSentence) || 'Community quest';

  let rewardKind: RewardKind = wantsUsdc ? 'usdc' : 'credits';
  let rewardAmount: number;
  if (rewardKind === 'usdc') {
    const dollar = lower.match(/\$\s*(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:usdc|usd|dollars?)/);
    const found = dollar ? Number(dollar[1] ?? dollar[2]) : NaN;
    rewardAmount = Number.isFinite(found)
      ? roundUsdc(Math.min(FORGE_LIMITS.usdcMax, Math.max(FORGE_LIMITS.usdcMin, found)))
      : 1;
  } else {
    const credits = lower.match(/(\d+)\s*(?:credits?|points?|shards?)/);
    const found = credits ? Number(credits[1]) : NaN;
    rewardAmount = clampInt(found, FORGE_LIMITS.creditsMin, FORGE_LIMITS.creditsMax, 50);
  }

  const targetMatch = lower.match(/(?:x|times|up to|first)\s*(\d{1,2})|(\d{1,2})\s*(?:people|members|completions?|users?)/);
  const targetCount = clampInt(
    targetMatch ? Number(targetMatch[1] ?? targetMatch[2]) : 1,
    FORGE_LIMITS.targetMin,
    FORGE_LIMITS.targetMax,
    1,
  );

  return {
    title,
    description: text.length > 600 ? text.slice(0, 597) + '…' : text,
    questType: proof ? 'proof-required' : 'no-proof',
    rewardKind,
    rewardAmount,
    targetCount,
  };
}

async function callDeepSeekJson(prompt: string): Promise<string> {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: DRAFT_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      stream: false,
      max_tokens: 600,
    }),
  });
  if (!response.ok) {
    throw new Error(`DeepSeek draft error: ${response.status}`);
  }
  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('DeepSeek returned empty draft');
  return content;
}

function parseAndClamp(raw: string, prompt: string): QuestDraft {
  // Pull the first JSON object out of the response, tolerating stray prose.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return heuristicDraft(prompt);

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return heuristicDraft(prompt);
  }

  const fallback = heuristicDraft(prompt);

  const title = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim().slice(0, FORGE_LIMITS.titleMax)
    : fallback.title;
  const description = typeof parsed.description === 'string' && parsed.description.trim()
    ? parsed.description.trim().slice(0, FORGE_LIMITS.descMax)
    : fallback.description;
  const questType: QuestForgeType = FORGE_TYPES.has(parsed.questType as QuestForgeType)
    ? (parsed.questType as QuestForgeType)
    : fallback.questType;
  const rewardKind: RewardKind = isRewardKind(parsed.rewardKind) ? parsed.rewardKind : fallback.rewardKind;
  const targetCount = clampInt(Number(parsed.targetCount), FORGE_LIMITS.targetMin, FORGE_LIMITS.targetMax, fallback.targetCount);

  let rewardAmount: number;
  const rawReward = Number(parsed.rewardAmount);
  if (rewardKind === 'usdc') {
    rewardAmount = Number.isFinite(rawReward)
      ? roundUsdc(Math.min(FORGE_LIMITS.usdcMax, Math.max(FORGE_LIMITS.usdcMin, rawReward)))
      : fallback.rewardAmount;
  } else {
    rewardAmount = clampInt(rawReward, FORGE_LIMITS.creditsMin, FORGE_LIMITS.creditsMax, 50);
  }

  return { title, description, questType, rewardKind, rewardAmount, targetCount };
}

/**
 * POST /api/quests/draft  { prompt }
 * VIP-membership-gated. Drafts a fundable quest from a plain-language request
 * so Blue can pre-fill the in-chat forge. Does NOT create anything.
 */
export async function POST(request: Request) {
  const user = await getCurrentUserFromRequestCookie();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const hasMembership = await walletHoldsVipMembershipCard(user.walletAddress);
  if (!hasMembership) {
    return NextResponse.json(
      { error: 'A membership NFT is required to forge quests.', code: 'vip_required' },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  if (!prompt) {
    return NextResponse.json({ error: 'Tell Blue what the quest should be.' }, { status: 400 });
  }

  let draft: QuestDraft;
  try {
    if (DEEPSEEK_API_KEY) {
      draft = parseAndClamp(await callDeepSeekJson(prompt), prompt);
    } else if (ELIZA_API_KEY) {
      const raw = await elizaAPI.chat({
        messages: [
          { role: 'system', content: DRAFT_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
        id: CHAT_MODEL,
        maxTokens: 600,
      });
      draft = parseAndClamp(raw, prompt);
    } else {
      draft = heuristicDraft(prompt);
    }
  } catch (err) {
    console.warn('[quests/draft] LLM draft failed, using heuristic:', err);
    draft = heuristicDraft(prompt);
  }

  return NextResponse.json({ draft });
}
