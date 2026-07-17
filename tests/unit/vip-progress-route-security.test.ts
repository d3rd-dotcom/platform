import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getVipCourseFull: vi.fn(),
  getVipProgress: vi.fn(),
  upsertVipProgress: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: mocks.getCurrentUser,
}));
vi.mock('@/lib/db', () => ({
  isDbConfigured: () => true,
}));
vi.mock('@/lib/vip-course-db', () => ({
  getVipCourseFull: mocks.getVipCourseFull,
  getVipProgress: mocks.getVipProgress,
  upsertVipProgress: mocks.upsertVipProgress,
}));

import { POST } from '@/app/api/vip/courses/[id]/progress/route';

describe('VIP progress route seal-state ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentUser.mockResolvedValue({ id: 'user-a' });
    mocks.getVipCourseFull.mockResolvedValue({
      id: 'course-a',
      weeks: [{ id: 'week-a', components: [] }],
    });
    mocks.upsertVipProgress.mockResolvedValue({ id: 'progress-a', isSealed: true });
  });

  it('ignores client isSealed while preserving legitimate progress saves', async () => {
    const response = await POST(
      new Request('http://localhost/api/vip/courses/course-a/progress', {
        method: 'POST',
        body: JSON.stringify({
          weekId: 'week-a',
          completedComponentIds: [],
          componentData: { reflection: 'saved' },
          isSealed: false,
        }),
      }),
      { params: { id: 'course-a' } },
    );

    expect(response.status).toBe(200);
    expect(mocks.upsertVipProgress).toHaveBeenCalledWith(
      'user-a',
      'course-a',
      'week-a',
      {
        completedComponentIds: [],
        componentData: { reflection: 'saved' },
      },
    );
  });

  it('does not create progress under a week from another course', async () => {
    mocks.getVipCourseFull.mockResolvedValue({
      id: 'course-a',
      weeks: [{ id: 'week-a', components: [] }],
    });

    const response = await POST(
      new Request('http://localhost/api/vip/courses/course-a/progress', {
        method: 'POST',
        body: JSON.stringify({ weekId: 'week-from-course-b', componentData: { note: 'x' } }),
      }),
      { params: { id: 'course-a' } },
    );

    expect(response.status).toBe(404);
    expect(mocks.upsertVipProgress).not.toHaveBeenCalled();
  });
});
