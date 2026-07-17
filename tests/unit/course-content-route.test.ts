import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCourseAccess: vi.fn(),
  ensureCourseContentSchema: vi.fn(),
  getCurrentUserFromRequestCookie: vi.fn(),
  sqlQuery: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUserFromRequestCookie: mocks.getCurrentUserFromRequestCookie,
}));
vi.mock('@/lib/course-access', () => ({
  checkCourseAccess: mocks.checkCourseAccess,
}));
vi.mock('@/lib/db', () => ({
  sqlQuery: mocks.sqlQuery,
}));
vi.mock('@/lib/ensureCourseContentSchema', () => ({
  ensureCourseContentSchema: mocks.ensureCourseContentSchema,
}));

import { GET as getCourseContent } from '@/app/api/course-content/[slug]/route';
import { GET as getCourseAccess } from '@/app/api/course-content/[slug]/access/route';

const courseRow = {
  id: 'course-1',
  slug: 'protected-course',
  title: 'Protected course',
  summary: 'Summary',
  description: 'Protected description',
  status: 'published',
  sort_order: 1,
  cover_image_url: null,
  estimated_weeks: 2,
  token_gate: 'academic_angel',
  created_by: null,
  updated_by: null,
  published_at: '2026-07-01T00:00:00.000Z',
  created_at: '2026-07-01T00:00:00.000Z',
  updated_at: '2026-07-01T00:00:00.000Z',
};

const request = new Request('https://academy.example/api/course-content/protected-course');
const context = { params: { slug: 'protected-course' } };

describe('public academy course content route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureCourseContentSchema.mockResolvedValue(undefined);
    mocks.getCurrentUserFromRequestCookie.mockResolvedValue({
      walletAddress: '0x1234',
    });
  });

  it('returns 403 before querying or serializing protected children when access is denied', async () => {
    mocks.sqlQuery.mockResolvedValueOnce([courseRow]);
    mocks.checkCourseAccess.mockResolvedValue({
      granted: false,
      gate: 'academic_angel',
    });

    const response = await getCourseContent(request, context);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      error: 'Course access required.',
      granted: false,
      gate: 'academic_angel',
      tokenGate: 'academic_angel',
    });
    expect(body).not.toHaveProperty('course');
    expect(body).not.toHaveProperty('chapters');
    expect(mocks.sqlQuery).toHaveBeenCalledTimes(1);
  });

  it('queries only published chapters and lessons after access is granted', async () => {
    const chapterRow = {
      id: 'chapter-1',
      course_id: 'course-1',
      slug: 'chapter-1',
      title: 'Chapter 1',
      summary: '',
      status: 'published',
      sort_order: 1,
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    };
    const lessonRow = {
      id: 'lesson-1',
      chapter_id: 'chapter-1',
      slug: 'lesson-1',
      title: 'Lesson 1',
      lesson_type: 'article',
      body_markdown: 'Published lesson body',
      video_url: null,
      resource_url: null,
      status: 'published',
      sort_order: 1,
      duration_minutes: 10,
      published_at: '2026-07-01T00:00:00.000Z',
      created_at: '2026-07-01T00:00:00.000Z',
      updated_at: '2026-07-01T00:00:00.000Z',
    };
    mocks.sqlQuery
      .mockResolvedValueOnce([courseRow])
      .mockResolvedValueOnce([chapterRow])
      .mockResolvedValueOnce([lessonRow]);
    mocks.checkCourseAccess.mockResolvedValue({
      granted: true,
      gate: 'academic_angel',
    });

    const response = await getCourseContent(request, context);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.chapters).toHaveLength(1);
    expect(body.chapters[0].lessons).toHaveLength(1);
    expect(String(mocks.sqlQuery.mock.calls[1][0])).toMatch(
      /academy_chapters[\s\S]+status = 'published'/,
    );
    expect(String(mocks.sqlQuery.mock.calls[2][0])).toMatch(
      /academy_lessons[\s\S]+status = 'published'/,
    );
  });

  it('fails closed when a stored token gate is unknown', async () => {
    mocks.sqlQuery.mockResolvedValueOnce([
      { token_gate: 'future_unconfigured_gate' },
    ]);
    mocks.checkCourseAccess.mockResolvedValue({ granted: true, gate: '' });

    const response = await getCourseAccess(request, context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      granted: false,
      gate: '',
      tokenGate: 'future_unconfigured_gate',
    });
  });
});
