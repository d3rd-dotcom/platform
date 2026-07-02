import { NextResponse } from 'next/server';
import { getCurrentUserFromRequestCookie } from '@/lib/auth';
import { isDbConfigured, sqlQuery } from '@/lib/db';
import { ensureVipCourseSchema } from '@/lib/ensureVipCourseSchema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface PublicCourseCard {
  id: string;
  slug: string;
  title: string;
  focus: string;
  coverImageUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  weekCount: number;
  totalTasks: number;
  memberCount: number;
  viewerCompletedTasks: number;
  viewerProgressPct: number;
}

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  await ensureVipCourseSchema();

  // Progress is optional — the listing itself is public.
  const user = await getCurrentUserFromRequestCookie().catch(() => null);

  const courses = await sqlQuery<Array<{
    id: string;
    slug: string;
    title: string;
    focus: string;
    cover_image_url: string | null;
    author_name: string | null;
    author_avatar: string | null;
  }>>(
    `SELECT c.id, c.slug, c.title, c.focus, c.cover_image_url,
            u.username AS author_name, u.avatar_url AS author_avatar
     FROM vip_courses c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.status = 'published'
     ORDER BY c.created_at ASC`,
  );

  if (courses.length === 0) {
    return NextResponse.json({ courses: [] });
  }

  const courseIds = courses.map((c) => c.id);

  const [weeks, components, blocks, members, viewerProgress] = await Promise.all([
    sqlQuery<Array<{ id: string; course_id: string }>>(
      `SELECT id, course_id FROM course_weeks WHERE course_id = ANY($1)`,
      [courseIds],
    ),
    sqlQuery<Array<{ id: string; week_id: string; component_type: string; title: string }>>(
      `SELECT c.id, c.week_id, c.component_type, c.title
       FROM course_components c
       JOIN course_weeks w ON w.id = c.week_id
       WHERE w.course_id = ANY($1)`,
      [courseIds],
    ),
    sqlQuery<Array<{ id: string; mission_id: string }>>(
      `SELECT mb.id, mb.mission_id
       FROM mission_blocks mb
       JOIN course_components c ON c.id = mb.mission_id
       JOIN course_weeks w ON w.id = c.week_id
       WHERE w.course_id = ANY($1)`,
      [courseIds],
    ),
    sqlQuery<Array<{ course_id: string; member_count: string }>>(
      `SELECT course_id, COUNT(DISTINCT user_id) AS member_count
       FROM vip_progress
       WHERE course_id = ANY($1)
       GROUP BY course_id`,
      [courseIds],
    ),
    user
      ? sqlQuery<Array<{ course_id: string; completed_component_ids: string[] }>>(
          `SELECT course_id, completed_component_ids
           FROM vip_progress
           WHERE user_id = $1 AND course_id = ANY($2)`,
          [user.id, courseIds],
        )
      : Promise.resolve([]),
  ]);

  const weekToCourse = new Map<string, string>();
  const weekCounts = new Map<string, number>();
  for (const w of weeks) {
    weekToCourse.set(w.id, w.course_id);
    weekCounts.set(w.course_id, (weekCounts.get(w.course_id) ?? 0) + 1);
  }

  // Required task ids per course, mirroring getRequiredTaskIds: mission
  // containers count by their blocks, the Weekly Read doesn't count.
  const requiredIdsByCourse = new Map<string, Set<string>>();
  const containerToCourse = new Map<string, string>();
  for (const comp of components) {
    const courseId = weekToCourse.get(comp.week_id);
    if (!courseId) continue;
    if (comp.component_type === 'mission_container') {
      containerToCourse.set(comp.id, courseId);
      continue;
    }
    if (comp.component_type === 'rich_text' && comp.title === 'Weekly Read') continue;
    let set = requiredIdsByCourse.get(courseId);
    if (!set) { set = new Set(); requiredIdsByCourse.set(courseId, set); }
    set.add(comp.id);
  }
  for (const block of blocks) {
    const courseId = containerToCourse.get(block.mission_id);
    if (!courseId) continue;
    let set = requiredIdsByCourse.get(courseId);
    if (!set) { set = new Set(); requiredIdsByCourse.set(courseId, set); }
    set.add(block.id);
  }

  const memberCounts = new Map<string, number>();
  for (const m of members) {
    memberCounts.set(m.course_id, parseInt(m.member_count, 10) || 0);
  }

  const viewerCompletedByCourse = new Map<string, Set<string>>();
  for (const row of viewerProgress) {
    let set = viewerCompletedByCourse.get(row.course_id);
    if (!set) { set = new Set(); viewerCompletedByCourse.set(row.course_id, set); }
    for (const id of row.completed_component_ids ?? []) set.add(id);
  }

  const payload: PublicCourseCard[] = courses.map((c) => {
    const required = requiredIdsByCourse.get(c.id) ?? new Set<string>();
    const completedRaw = viewerCompletedByCourse.get(c.id) ?? new Set<string>();
    let completed = 0;
    for (const id of completedRaw) {
      if (required.has(id)) completed++;
    }
    const total = required.size;
    return {
      id: c.id,
      slug: c.slug,
      title: c.title,
      focus: c.focus,
      coverImageUrl: c.cover_image_url,
      authorName: c.author_name ?? '',
      authorAvatar: c.author_avatar,
      weekCount: weekCounts.get(c.id) ?? 0,
      totalTasks: total,
      memberCount: memberCounts.get(c.id) ?? 0,
      viewerCompletedTasks: completed,
      viewerProgressPct: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return NextResponse.json({ courses: payload });
}
