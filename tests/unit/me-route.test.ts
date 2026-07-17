import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ensureForumSchema: vi.fn(),
  getCurrentUserFromRequestCookie: vi.fn(),
  isDbConfigured: vi.fn(),
  isOwnStorageUrl: vi.fn(),
  sqlQuery: vi.fn(),
  uploadBucket: vi.fn(),
}));

vi.mock('@/lib/ensureForumSchema', () => ({ ensureForumSchema: mocks.ensureForumSchema }));
vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: mocks.getCurrentUserFromRequestCookie,
}));
vi.mock('@/lib/db', () => ({
  isDbConfigured: mocks.isDbConfigured,
  sqlQuery: mocks.sqlQuery,
}));
vi.mock('@/lib/diamonds-balance', () => ({ fetchDiamondBalance: vi.fn() }));
vi.mock('@/lib/supabase-storage', () => ({
  isOwnStorageUrl: mocks.isOwnStorageUrl,
  uploadBucket: mocks.uploadBucket,
}));

import { PUT } from '@/app/api/me/route';

const user = { id: 'user-1' };

function put(body: unknown) {
  return PUT(
    new Request('https://academy.example/api/me', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('PUT /api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isDbConfigured.mockReturnValue(true);
    mocks.ensureForumSchema.mockResolvedValue(undefined);
    mocks.getCurrentUserFromRequestCookie.mockResolvedValue(user);
    mocks.sqlQuery.mockResolvedValue([]);
    mocks.uploadBucket.mockReturnValue('uploads');
  });

  it('preserves the avatar when a username-only update omits avatarUrl', async () => {
    const response = await put({ username: 'new_name' });

    expect(response.status).toBe(200);
    expect(mocks.sqlQuery).toHaveBeenCalledWith(
      expect.stringContaining('CASE WHEN :hasAvatarUrl THEN :avatarUrl ELSE avatar_url END'),
      expect.objectContaining({
        id: 'user-1',
        username: 'new_name',
        avatarUrl: null,
        hasAvatarUrl: false,
      }),
    );
  });

  it('allows an explicit null avatarUrl to clear the avatar', async () => {
    const response = await put({ avatarUrl: null });

    expect(response.status).toBe(200);
    expect(mocks.sqlQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ avatarUrl: null, hasAvatarUrl: true }),
    );
  });

  it('rejects external avatar URLs', async () => {
    mocks.isOwnStorageUrl.mockReturnValue(false);

    const response = await put({ avatarUrl: 'https://untrusted.example/avatar.png' });

    expect(response.status).toBe(400);
    expect(mocks.sqlQuery).not.toHaveBeenCalled();
  });

  it('accepts a supported image URL from the upload bucket', async () => {
    mocks.isOwnStorageUrl.mockReturnValue(true);
    const avatarUrl = 'https://project.supabase.co/storage/v1/object/public/uploads/avatar.webp';

    const response = await put({ avatarUrl });

    expect(response.status).toBe(200);
    expect(mocks.isOwnStorageUrl).toHaveBeenCalledWith(avatarUrl, 'uploads');
    expect(mocks.sqlQuery).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ avatarUrl, hasAvatarUrl: true }),
    );
  });
});
