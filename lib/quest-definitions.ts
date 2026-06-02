export type QuestType =
  | 'proof-required'
  | 'no-proof'
  | 'twitter-follow'
  | 'follow-and-own'
  | 'sealed-week';

export interface QuestDefinition {
  key: string;
  title: string;
  points: number;
  desc: string;
  questType: QuestType;
  targetCount: number;
  weekNumber?: number;
  icon?: string;
  /**
   * Real USDC bounty (in whole dollars) paid by Blue once a staff member
   * approves the submission. Only set on official quests Blue funds — custom
   * user-authored quests are funded and judged by their creator, never Blue.
   * Eligibility requires the recipient to hold an Academic Angel NFT.
   */
  usdcReward?: number;
}

export const QUEST_DEFINITIONS: QuestDefinition[] = [
  {
    key: 'quest-week-1-sealed',
    title: 'First Light',
    points: 100,
    desc: 'Finish the full Week 1 course and seal it from your home dashboard.',
    questType: 'sealed-week',
    targetCount: 1,
    weekNumber: 1,
  },
  {
    key: 'quest-week-2-sealed',
    title: 'Deeper Currents',
    points: 100,
    desc: 'Finish the full Week 2 course and seal it from your home dashboard.',
    questType: 'sealed-week',
    targetCount: 1,
    weekNumber: 2,
  },
  {
    key: 'quest-blog-post',
    title: 'Stories from the Field',
    points: 100,
    desc: 'Your experience is worth more than you think — and sharing it helps someone who is right where you used to be. Write one honest entry about something you have learned, lived through, or figured out along the way. There is no wrong way to tell it, and your story makes this community a little warmer.',
    questType: 'proof-required',
    targetCount: 1,
    usdcReward: 50,
  },
  {
    key: 'quest-onboard-member',
    title: 'Pass the Torch',
    points: 75,
    desc: 'Walk someone through their first week in the academy.',
    questType: 'no-proof',
    targetCount: 1,
  },
  {
    key: 'twitter-follow-quest',
    title: 'Catch the Signal',
    points: 40,
    desc: 'Connect your X account and follow the official Mental Wealth Academy account.',
    questType: 'twitter-follow',
    targetCount: 1,
  },
];

export const QUEST_DEFINITION_MAP = Object.fromEntries(
  QUEST_DEFINITIONS.map((quest) => [quest.key, quest])
) as Record<string, QuestDefinition>;

const REPEATABLE_QUEST_KEYS = new Set(
  QUEST_DEFINITIONS.filter((quest) => quest.targetCount > 1).map((quest) => quest.key)
);

export function getQuestDefinition(questKey: string): QuestDefinition | null {
  return QUEST_DEFINITION_MAP[questKey] ?? null;
}

export function getQuestDefinitionForStoredQuestId(questId: string): QuestDefinition | null {
  const direct = getQuestDefinition(questId);
  if (direct) return direct;

  for (const questKey of REPEATABLE_QUEST_KEYS) {
    if (new RegExp(`^${questKey}-\\d+$`).test(questId)) {
      return QUEST_DEFINITION_MAP[questKey];
    }
  }

  return null;
}

export function isRepeatableQuest(questKey: string): boolean {
  const definition = getQuestDefinition(questKey);
  return !!definition && definition.targetCount > 1;
}

/**
 * Whole-dollar USDC bounty for a quest id (handles repeatable "-N" suffixes),
 * or 0 if the quest is not a Blue-funded USDC quest.
 */
export function getQuestUsdcReward(questId: string): number {
  const definition = getQuestDefinitionForStoredQuestId(questId) ?? getQuestDefinition(questId);
  return definition?.usdcReward ?? 0;
}
