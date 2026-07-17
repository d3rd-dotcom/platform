import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sqlQuery: vi.fn(),
  withTransaction: vi.fn(),
  deliverDiamondsOnchain: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: vi.fn(async () => ({
    id: 'user-1',
    username: 'member',
    avatarUrl: null,
    walletAddress: '0x1111111111111111111111111111111111111111',
    accountType: 'human',
  })),
}));
vi.mock('@/lib/db', () => ({
  isDbConfigured: () => true,
  sqlQuery: mocks.sqlQuery,
  withTransaction: mocks.withTransaction,
  sqlQueryWithClient: vi.fn(),
}));
vi.mock('@/lib/quest-definitions', () => ({
  getQuestDefinition: () => null,
  getQuestDefinitionForStoredQuestId: () => null,
}));
vi.mock('@/lib/ensureForumSchema', () => ({ ensureForumSchema: vi.fn() }));
vi.mock('@/lib/ensureWeeksSchema', () => ({ ensureWeeksSchema: vi.fn() }));
vi.mock('@/lib/ensureCustomQuestsSchema', () => ({ ensureCustomQuestsSchema: vi.fn() }));
vi.mock('@/lib/ensurePrayersSchema', () => ({ ensurePrayersSchema: vi.fn() }));
vi.mock('@/lib/ensureQuestUsdcClaimsSchema', () => ({ ensureQuestUsdcClaimsSchema: vi.fn() }));
vi.mock('@/lib/supabase-storage', () => ({ isOwnStorageUrl: () => true }));
vi.mock('@/lib/blue-memory', () => ({ recordBlueQuestCompletion: vi.fn() }));
vi.mock('@/lib/chat', () => ({ postSystemMessage: vi.fn() }));
vi.mock('@/lib/room-log', () => ({ recordAgentActivity: vi.fn() }));
vi.mock('@/lib/diamonds-onchain', () => ({ deliverDiamondsOnchain: mocks.deliverDiamondsOnchain }));

import { POST } from '@/app/api/quests/complete/route';

function request(questId: string) {
  return new Request('https://academy.example/api/quests/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questId }),
  });
}

describe('/api/quests/complete reward gates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.sqlQuery.mockResolvedValue([]);
  });

  it('rejects an invented quest id before the award transaction', async () => {
    const response = await POST(request('fabricated-paying-quest'));
    expect(response.status).toBe(404);
    expect(mocks.withTransaction).not.toHaveBeenCalled();
    expect(mocks.deliverDiamondsOnchain).not.toHaveBeenCalled();
  });

  it('keeps balloon milestone rewards closed', async () => {
    const response = await POST(request('balloon-5'));
    expect(response.status).toBe(409);
    expect(mocks.withTransaction).not.toHaveBeenCalled();
    expect(mocks.deliverDiamondsOnchain).not.toHaveBeenCalled();
  });

  it('requires the server-owned daily-note completion ledger', async () => {
    mocks.sqlQuery.mockImplementation(async (query: string) => {
      if (query.includes('daily_note_completions')) return [{ complete: false }];
      return [];
    });

    const response = await POST(request('daily-notes-w1-d1'));
    expect(response.status).toBe(409);
    expect(mocks.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('daily_note_completions'),
      { userId: 'user-1', week: 1, day: 1 },
    );
    expect(mocks.withTransaction).not.toHaveBeenCalled();
  });

  it('routes a funded no-proof custom credit quest to pending creator review', async () => {
    mocks.sqlQuery.mockImplementation(async (query: string) => {
      if (query.includes('FROM custom_quests')) {
        return [{
          id: 'cq_abcd',
          points: 25,
          target_count: 1,
          quest_type: 'no-proof',
          assignee_wallet: null,
          archived_at: null,
          expires_at: null,
          reward_kind: 'credits',
          reward_amount: '25',
          escrow_remaining: '25',
          escrow_status: 'funded',
        }];
      }
      if (query.includes('COUNT(*)::text')) return [{ n: '0' }];
      return [];
    });

    const response = await POST(request('cq_abcd'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, status: 'pending_review', rewardKind: 'credits' });
    expect(mocks.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO quest_usdc_claims'),
      expect.objectContaining({ questId: 'cq_abcd', rewardKind: 'credits' }),
    );
    expect(mocks.withTransaction).not.toHaveBeenCalled();
    expect(mocks.deliverDiamondsOnchain).not.toHaveBeenCalled();
  });
});
