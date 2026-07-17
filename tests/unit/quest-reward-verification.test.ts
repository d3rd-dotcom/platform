import { describe, expect, it, vi } from 'vitest';

const payoutMocks = vi.hoisted(() => ({
  getPool: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  getPool: payoutMocks.getPool,
}));

import {
  parseBalloonMilestone,
  parseDailyNoteQuestId,
} from '@/lib/quest-reward-verification';
import {
  distributeUSDC,
  isUsdcPayoutRetrySafe,
  persistUsdcHashBeforeBroadcast,
} from '@/lib/blue-usdc';

describe('quest reward verification', () => {
  it('accepts only field-note ids inside the twelve-week, seven-day course', () => {
    expect(parseDailyNoteQuestId('daily-notes-w1-d1')).toEqual({ week: 1, day: 1 });
    expect(parseDailyNoteQuestId('daily-notes-w12-d7')).toEqual({ week: 12, day: 7 });
    expect(parseDailyNoteQuestId('daily-notes-w13-d1')).toBeNull();
    expect(parseDailyNoteQuestId('daily-notes-w1-d8')).toBeNull();
    expect(parseDailyNoteQuestId('daily-notes-w1-d1-extra')).toBeNull();
  });

  it('accepts only bounded five-pop milestones', () => {
    expect(parseBalloonMilestone('balloon-5')).toBe(5);
    expect(parseBalloonMilestone('balloon-100')).toBe(100);
    expect(parseBalloonMilestone('balloon-0')).toBeNull();
    expect(parseBalloonMilestone('balloon-6')).toBeNull();
    expect(parseBalloonMilestone('balloon-105')).toBeNull();
    expect(parseBalloonMilestone('balloon-5-extra')).toBeNull();
  });
});

describe('USDC payout retry safety', () => {
  const baseFailure = { address: '0x0000000000000000000000000000000000000001', error: 'failed' };

  it('allows a retry when no transaction was broadcast', () => {
    expect(isUsdcPayoutRetrySafe({
      ...baseFailure,
      broadcast: false,
      confirmedFailure: false,
    })).toBe(true);
  });

  it('keeps an uncertain broadcast locked', () => {
    expect(isUsdcPayoutRetrySafe({
      ...baseFailure,
      broadcast: true,
      txHash: `0x${'1'.repeat(64)}`,
      confirmedFailure: false,
    })).toBe(false);
  });

  it('allows a retry after a mined revert', () => {
    expect(isUsdcPayoutRetrySafe({
      ...baseFailure,
      broadcast: true,
      txHash: `0x${'2'.repeat(64)}`,
      confirmedFailure: true,
    })).toBe(true);
  });

  it('does not broadcast when durable hash persistence fails', async () => {
    const broadcast = vi.fn(async () => 'sent');
    await expect(persistUsdcHashBeforeBroadcast({
      persist: async () => { throw new Error('database unavailable'); },
      broadcast,
    })).rejects.toThrow('database unavailable');
    expect(broadcast).not.toHaveBeenCalled();
  });

  it('broadcasts only after durable hash persistence succeeds', async () => {
    const order: string[] = [];
    await expect(persistUsdcHashBeforeBroadcast({
      persist: async () => { order.push('persisted'); },
      broadcast: async () => { order.push('broadcast'); return 'sent'; },
    })).resolves.toBe('sent');
    expect(order).toEqual(['persisted', 'broadcast']);
  });

  it('stops before transaction preparation when another payout owns the wallet lock', async () => {
    const release = vi.fn();
    payoutMocks.getPool.mockReturnValue({
      connect: vi.fn(async () => ({
        query: vi.fn(async () => ({ rows: [{ acquired: false }] })),
        release,
      })),
    });

    await expect(distributeUSDC([
      {
        address: '0x0000000000000000000000000000000000000001',
        amount: '1000000',
      },
    ])).rejects.toThrow('A Blue payout is already in progress');
    expect(release).toHaveBeenCalledOnce();
  });
});
