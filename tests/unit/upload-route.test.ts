import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIdentifier: vi.fn(),
  getCurrentUserFromRequestCookie: vi.fn(),
  getRateLimitHeaders: vi.fn(),
  isStorageConfigured: vi.fn(),
  uploadBucket: vi.fn(),
  uploadPublicObject: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: mocks.getCurrentUserFromRequestCookie,
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIdentifier: mocks.getClientIdentifier,
  getRateLimitHeaders: mocks.getRateLimitHeaders,
}));
vi.mock('@/lib/supabase-storage', () => ({
  isStorageConfigured: mocks.isStorageConfigured,
  uploadBucket: mocks.uploadBucket,
  uploadPublicObject: mocks.uploadPublicObject,
}));

import { POST } from '@/app/api/upload/route';

describe('/api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockReturnValue({
      allowed: true,
      limit: 5,
      remaining: 4,
      resetAt: Date.now() + 60_000,
    });
    mocks.getClientIdentifier.mockReturnValue('test-client');
    mocks.getCurrentUserFromRequestCookie.mockResolvedValue({ id: 'user-1' });
    mocks.isStorageConfigured.mockReturnValue(true);
    mocks.uploadBucket.mockReturnValue('uploads');
    mocks.uploadPublicObject.mockResolvedValue({
      url: 'https://project.supabase.co/storage/v1/object/public/uploads/file-id.png',
      path: 'file-id.png',
    });
  });

  it('stores an authenticated image in durable Supabase Storage and preserves the response shape', async () => {
    const form = new FormData();
    form.set('file', new File(['image bytes'], '../avatar.png', { type: 'image/png' }));
    const request = new Request('https://academy.example/api/upload', {
      method: 'POST',
      body: form,
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.uploadPublicObject).toHaveBeenCalledWith({
      bucket: 'uploads',
      data: expect.any(ArrayBuffer),
      contentType: 'image/png',
      ext: 'png',
    });
    expect(body).toEqual({
      url: 'https://project.supabase.co/storage/v1/object/public/uploads/file-id.png',
      name: 'avatar.png',
      mime: 'image/png',
      size: 11,
    });
  });

  it('fails closed when Supabase Storage is unavailable', async () => {
    mocks.isStorageConfigured.mockReturnValue(false);
    const request = new Request('https://academy.example/api/upload', {
      method: 'POST',
      body: new FormData(),
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'File uploads are temporarily unavailable.',
    });
    expect(mocks.uploadPublicObject).not.toHaveBeenCalled();
  });
});

describe('Supabase upload URL validation', () => {
  const originalUrl = process.env.SUPABASE_URL;
  const originalBucket = process.env.SUPABASE_UPLOAD_BUCKET;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = originalUrl;
    if (originalBucket === undefined) delete process.env.SUPABASE_UPLOAD_BUCKET;
    else process.env.SUPABASE_UPLOAD_BUCKET = originalBucket;
  });

  it('recognizes only URLs in the configured public upload bucket', async () => {
    // Load the real helper in isolation because the route tests mock its module.
    const storage = await vi.importActual<typeof import('@/lib/supabase-storage')>(
      '@/lib/supabase-storage',
    );
    process.env.SUPABASE_URL = 'https://project.supabase.co';
    process.env.SUPABASE_UPLOAD_BUCKET = 'academy-images';

    expect(storage.uploadBucket()).toBe('academy-images');
    expect(storage.publicUrlPrefix(storage.uploadBucket())).toBe(
      'https://project.supabase.co/storage/v1/object/public/academy-images/',
    );
    expect(
      storage.isOwnStorageUrl(
        'https://project.supabase.co/storage/v1/object/public/academy-images/file.webp',
        storage.uploadBucket(),
      ),
    ).toBe(true);
    expect(
      storage.isOwnStorageUrl(
        'https://attacker.example/storage/v1/object/public/academy-images/file.webp',
        storage.uploadBucket(),
      ),
    ).toBe(false);
  });
});
