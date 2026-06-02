/**
 * Shared rules for creator-funded quests forged through Blue chat (and the
 * /quests "Quest forge" panel). Create, draft, complete, and creator-review
 * all import from here so the limits and reward math never drift apart.
 */

export type QuestForgeType = 'no-proof' | 'proof-required';
export type RewardKind = 'credits' | 'usdc';

export const FORGE_LIMITS = {
  titleMax: 80,
  descMax: 600,
  pointsMin: 1,
  pointsMax: 1000,
  targetMin: 1,
  targetMax: 50,
  // Credits a completer can receive per completion.
  creditsMin: 1,
  creditsMax: 1000,
  // USDC a completer can receive per completion (real money — kept tight).
  usdcMin: 0.25,
  usdcMax: 25,
  // Hard ceiling on what Blue will hold in escrow for a single USDC quest.
  usdcEscrowTotalMax: Number(process.env.QUEST_FORGE_USDC_ESCROW_MAX || '100'),
} as const;

export const USDC_DECIMALS = 6;

export const FORGE_TYPES = new Set<QuestForgeType>(['no-proof', 'proof-required']);

export function isRewardKind(value: unknown): value is RewardKind {
  return value === 'credits' || value === 'usdc';
}

/** Round a USDC amount to 6 dp without floating-point drift. */
export function roundUsdc(amount: number): number {
  return Math.round(amount * 10 ** USDC_DECIMALS) / 10 ** USDC_DECIMALS;
}

/** Convert a decimal USDC amount to base units (6 dp) as a string. */
export function usdcToUnits(amount: number): string {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS)).toString();
}

export interface RewardValidation {
  ok: boolean;
  error?: string;
  /** Normalized per-completion reward (integer for credits, ≤6dp for usdc). */
  amount: number;
  /** amount × targetCount — the full amount Blue escrows. */
  escrowTotal: number;
}

/**
 * Validates and normalizes the reward for a forged quest. `targetCount` must
 * already be a validated integer in [targetMin, targetMax].
 */
export function validateReward(
  rewardKind: RewardKind,
  rawAmount: number,
  targetCount: number,
): RewardValidation {
  const fail = (error: string): RewardValidation => ({ ok: false, error, amount: 0, escrowTotal: 0 });

  if (!Number.isFinite(rawAmount)) return fail('Enter a reward amount.');

  if (rewardKind === 'credits') {
    const amount = Math.round(rawAmount);
    if (amount < FORGE_LIMITS.creditsMin || amount > FORGE_LIMITS.creditsMax) {
      return fail(`Credit reward must be between ${FORGE_LIMITS.creditsMin} and ${FORGE_LIMITS.creditsMax}.`);
    }
    return { ok: true, amount, escrowTotal: amount * targetCount };
  }

  // usdc
  const amount = roundUsdc(rawAmount);
  if (amount < FORGE_LIMITS.usdcMin || amount > FORGE_LIMITS.usdcMax) {
    return fail(`USDC reward must be between $${FORGE_LIMITS.usdcMin} and $${FORGE_LIMITS.usdcMax} per completion.`);
  }
  const escrowTotal = roundUsdc(amount * targetCount);
  if (escrowTotal > FORGE_LIMITS.usdcEscrowTotalMax) {
    return fail(`Total USDC escrow ($${escrowTotal}) exceeds the $${FORGE_LIMITS.usdcEscrowTotalMax} limit. Lower the amount or target count.`);
  }
  return { ok: true, amount, escrowTotal };
}
