import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getKnowledgeMap: vi.fn(),
  optionalUser: vi.fn(),
}));

vi.mock('@/lib/guides-db', () => ({
  getKnowledgeMap: mocks.getKnowledgeMap,
}));
vi.mock('@/lib/guide-api-auth', () => ({
  optionalUser: mocks.optionalUser,
}));

import { GET } from '@/app/api/guides/map/route';

const map = {
  levels: 1,
  nodes: [
    {
      id: 'guide-1',
      slug: 'foundations',
      topicTitle: 'Foundations',
      status: 'published',
      level: 0,
      prereqIds: [],
      completed: false,
      subjects: ['Foundations'],
      summary: 'Start here.',
    },
  ],
};

describe('GET /api/guides/map', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getKnowledgeMap.mockResolvedValue(map);
  });

  it('serves a cacheable public map without resolving auth', async () => {
    const response = await GET(
      new Request('https://academy.example/api/guides/map?public=1'),
    );

    expect(response.status).toBe(200);
    expect(mocks.optionalUser).not.toHaveBeenCalled();
    expect(mocks.getKnowledgeMap).toHaveBeenCalledWith(null);
    expect(response.headers.get('cache-control')).toContain('s-maxage=300');
    expect(await response.json()).toEqual({ map, authenticated: false });
  });

  it('keeps the signed-in map personalized and uncached', async () => {
    mocks.optionalUser.mockResolvedValue({ userId: 'user-1' });

    const response = await GET(
      new Request('https://academy.example/api/guides/map'),
    );

    expect(mocks.optionalUser).toHaveBeenCalledOnce();
    expect(mocks.getKnowledgeMap).toHaveBeenCalledWith('user-1');
    expect(response.headers.get('cache-control')).toBeNull();
  });
});
