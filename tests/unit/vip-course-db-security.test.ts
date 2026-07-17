import { beforeEach, describe, expect, it, vi } from 'vitest';

const dbMocks = vi.hoisted(() => ({
  sqlQuery: vi.fn(),
  withTransaction: vi.fn(),
}));

vi.mock('@/lib/db', () => dbMocks);
vi.mock('@/lib/ensureVipCourseSchema', () => ({
  ensureVipCourseSchema: vi.fn(),
}));

import {
  createCourseComponent,
  deleteCourseComponent,
  deleteCourseWeek,
  reorderCourseComponents,
  updateCourseComponent,
  updateCourseWeek,
  upsertVipProgress,
} from '@/lib/vip-course-db';

describe('VIP course child mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.sqlQuery.mockResolvedValue([]);
  });

  it('scopes week updates and deletes to the route course', async () => {
    await updateCourseWeek('course-a', 'week-b', { title: 'Changed' });
    await deleteCourseWeek('course-a', 'week-b');

    const update = dbMocks.sqlQuery.mock.calls[0];
    const deletion = dbMocks.sqlQuery.mock.calls[1];
    expect(update[0]).toMatch(/WHERE id = :id AND course_id = :courseId/);
    expect(update[1]).toMatchObject({ id: 'week-b', courseId: 'course-a' });
    expect(deletion[0]).toMatch(/WHERE id = :id AND course_id = :courseId/);
    expect(deletion[1]).toEqual({ id: 'week-b', courseId: 'course-a' });
  });

  it('creates a component only through a week belonging to the route course', async () => {
    const result = await createCourseComponent({
      courseId: 'course-a',
      weekId: 'week-b',
      componentType: 'rich_text',
    });

    const insert = dbMocks.sqlQuery.mock.calls[1];
    expect(insert[0]).toMatch(/FROM course_weeks/);
    expect(insert[0]).toMatch(/id = :weekId AND course_id = :courseId/);
    expect(insert[1]).toMatchObject({ courseId: 'course-a', weekId: 'week-b' });
    expect(result).toBeNull();
  });

  it('scopes component updates and deletes through both week and course', async () => {
    await updateCourseComponent('course-a', 'week-b', 'component-c', { title: 'Changed' });
    await deleteCourseComponent('course-a', 'week-b', 'component-c');

    const update = dbMocks.sqlQuery.mock.calls[0];
    const deletion = dbMocks.sqlQuery.mock.calls[1];
    for (const call of [update, deletion]) {
      expect(call[0]).toMatch(/component\.week_id = :weekId/);
      expect(call[0]).toMatch(/week\.course_id = :courseId/);
      expect(call[1]).toMatchObject({
        courseId: 'course-a',
        weekId: 'week-b',
        id: 'component-c',
      });
    }
  });

  it('rejects reorder IDs that are outside the authorized week', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: 'week-b' }] })
        .mockResolvedValueOnce({ rows: [{ id: 'component-c' }] }),
    };
    dbMocks.withTransaction.mockImplementation(
      (callback: (transactionClient: typeof client) => unknown) => callback(client),
    );

    await expect(
      reorderCourseComponents('course-a', 'week-b', ['component-c', 'component-other']),
    ).rejects.toThrow(/outside this week/);
    expect(client.query.mock.calls[0][0]).toMatch(/id = \$1 AND course_id = \$2 FOR UPDATE/);
    expect(client.query).toHaveBeenCalledTimes(2);
  });
});

describe('VIP progress sealing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.sqlQuery.mockResolvedValue([{
      id: 'progress',
      user_id: 'user',
      course_id: 'course',
      week_id: 'week',
      completed_component_ids: [],
      component_data: {},
      is_sealed: true,
      sealed_at: '2026-07-17T00:00:00.000Z',
      created_at: '2026-07-17T00:00:00.000Z',
      updated_at: '2026-07-17T00:00:00.000Z',
    }]);
  });

  it('upserts ordinary progress atomically without assigning seal state', async () => {
    const result = await upsertVipProgress('user', 'course', 'week', {
      completedComponentIds: ['component'],
      componentData: { note: 'saved' },
    });

    const [query, params] = dbMocks.sqlQuery.mock.calls[0];
    expect(query).toMatch(/ON CONFLICT \(user_id, course_id, week_id\) DO UPDATE/);
    expect(query).not.toMatch(/SET[\s\S]*is_sealed\s*=/);
    expect(params).not.toHaveProperty('isSealed');
    expect(result.isSealed).toBe(true);
  });
});
