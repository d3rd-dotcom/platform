import { beforeEach, describe, expect, it, vi } from 'vitest';

const TX_HASH = `0x${'a'.repeat(64)}`;

const mocks = vi.hoisted(() => ({
  sqlQuery: vi.fn(),
  distributeUSDC: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: vi.fn(async () => ({
    id: 'reviewer-1',
    walletAddress: '0x2222222222222222222222222222222222222222',
  })),
}));
vi.mock('@/lib/db', () => ({
  isDbConfigured: () => true,
  sqlQuery: mocks.sqlQuery,
  withTransaction: vi.fn(),
  sqlQueryWithClient: vi.fn(),
}));
vi.mock('@/lib/ensureForumSchema', () => ({ ensureForumSchema: vi.fn() }));
vi.mock('@/lib/ensureCustomQuestsSchema', () => ({ ensureCustomQuestsSchema: vi.fn() }));
vi.mock('@/lib/ensureQuestUsdcClaimsSchema', () => ({ ensureQuestUsdcClaimsSchema: vi.fn() }));
vi.mock('@/lib/staff-auth', () => ({ isStaffUser: () => true }));
vi.mock('@/lib/academic-angels', () => ({ walletHoldsAcademicAngel: vi.fn(async () => true) }));
vi.mock('@/lib/quest-definitions', () => ({ getQuestDefinition: () => null }));
vi.mock('@/lib/quest-forge', () => ({ usdcToUnits: (amount: number) => String(amount * 1_000_000) }));
vi.mock('@/lib/diamonds-onchain', () => ({ deliverDiamondsOnchain: vi.fn() }));
vi.mock('@/lib/blue-usdc', () => ({
  distributeUSDC: mocks.distributeUSDC,
  isUsdcPayoutRetrySafe: (failure: { broadcast: boolean; confirmedFailure: boolean }) => (
    !failure.broadcast || failure.confirmedFailure
  ),
  verifyUSDCTransfer: vi.fn(),
}));

import { POST as staffReview } from '@/app/api/quests/usdc/review/route';
import { POST as creatorReview } from '@/app/api/quests/usdc/creator-review/route';

function approvalRequest() {
  return new Request('https://academy.example/api/quests/usdc/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claimId: 'claim-1', action: 'approve' }),
  });
}

describe('USDC review finalization failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.distributeUSDC.mockImplementation(async (_recipients, options) => {
      await options.onPrepared({ txHash: TX_HASH });
      return { txHashes: [TX_HASH], failed: [] };
    });
  });

  it('keeps a confirmed staff payout approved when the final write fails', async () => {
    mocks.sqlQuery.mockImplementation(async (query: string) => {
      if (query.includes('FROM quest_usdc_claims WHERE id')) {
        return [{
          id: 'claim-1', user_id: 'member-1', quest_id: 'quest-blog-post',
          recipient_wallet: '0x1111111111111111111111111111111111111111',
          usdc_amount: '1', status: 'pending', tx_hash: null, note: null,
          created_at: '2026-07-17', username: null,
        }];
      }
      if (query.includes("SET status = 'approved'")) return [{ id: 'claim-1' }];
      if (query.includes('SET tx_hash = :tx')) return [{ id: 'claim-1' }];
      if (query.includes("SET status = 'paid'")) throw new Error('database unavailable');
      return [];
    });

    const response = await staffReview(approvalRequest());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ claim: { status: 'approved', txHash: TX_HASH } });
    expect(mocks.sqlQuery.mock.calls.some(([query]) => (
      String(query).includes("SET status = 'pending'")
    ))).toBe(false);
  });

  it('keeps confirmed creator escrow reserved when the final write fails', async () => {
    mocks.sqlQuery.mockImplementation(async (query: string) => {
      if (query.includes('JOIN custom_quests')) {
        return [{
          id: 'claim-1', user_id: 'member-1', quest_id: 'cq_abcd',
          recipient_wallet: '0x1111111111111111111111111111111111111111',
          usdc_amount: '1', reward_kind: 'usdc', status: 'pending', tx_hash: null,
          created_at: '2026-07-17', username: null, quest_title: 'Custom quest',
          created_by: 'reviewer-1', escrow_remaining: '1', escrow_status: 'funded',
        }];
      }
      if (query.includes("SET status = 'approved'")) return [{ id: 'claim-1' }];
      if (query.includes('UPDATE custom_quests')) return [{ escrow_remaining: '0' }];
      if (query.includes('SET tx_hash = :tx')) return [{ id: 'claim-1' }];
      if (query.includes('INSERT INTO quests')) return [];
      if (query.includes("SET status = 'paid'")) throw new Error('database unavailable');
      return [];
    });

    const response = await creatorReview(approvalRequest());
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({ claim: { status: 'approved', txHash: TX_HASH } });
    expect(mocks.sqlQuery.mock.calls.filter(([query]) => (
      String(query).includes('UPDATE custom_quests')
    ))).toHaveLength(1);
    expect(mocks.sqlQuery.mock.calls.some(([query]) => (
      String(query).includes("SET status = 'pending'")
    ))).toBe(false);
  });
});
