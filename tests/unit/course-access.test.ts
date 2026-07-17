import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  walletHoldsAcademicAngel: vi.fn(),
  walletHasMembershipAccess: vi.fn(),
}));

vi.mock('@/lib/academic-angels', () => ({
  walletHoldsAcademicAngel: mocks.walletHoldsAcademicAngel,
}));
vi.mock('@/lib/membership-access', () => ({
  walletHasMembershipAccess: mocks.walletHasMembershipAccess,
}));

import { checkCourseAccess, parseTokenGate } from '@/lib/course-access';

describe('course access gates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recognizes the VIP membership gate and grants cardholders or subscribers', async () => {
    mocks.walletHasMembershipAccess.mockResolvedValue(true);

    await expect(checkCourseAccess('vip_membership', '0xmember')).resolves.toEqual({
      granted: true,
      gate: 'vip_membership',
    });
    expect(mocks.walletHasMembershipAccess).toHaveBeenCalledWith('0xmember');
  });

  it('fails closed for an unconfigured gate without calling a checker', async () => {
    await expect(checkCourseAccess('future_gate', '0xmember')).resolves.toEqual({
      granted: false,
      gate: '',
    });
    expect(mocks.walletHoldsAcademicAngel).not.toHaveBeenCalled();
    expect(mocks.walletHasMembershipAccess).not.toHaveBeenCalled();
  });

  it('parses only the configured gate names', () => {
    expect(parseTokenGate('vip_membership')).toBe('vip_membership');
    expect(parseTokenGate('future_gate')).toBe('');
  });

  it('keeps courses without a gate public', async () => {
    await expect(checkCourseAccess('', undefined)).resolves.toEqual({
      granted: true,
      gate: '',
    });
  });
});
