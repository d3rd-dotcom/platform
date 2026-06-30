import { sqlQuery, withTransaction } from './db';
import { ensureVipCourseSchema } from './ensureVipCourseSchema';

export type ComponentType =
  | 'rich_text'
  | 'multiple_choice'
  | 'media_embed'
  | 'image_embed'
  | 'video_embed'
  | 'file_upload'
  | 'text_input'
  | 'rating_scale'
  | 'reflection_journal'
  | 'quiz_block'
  | 'password_gate'
  | 'mission_container';

export type VipCourseStatus = 'draft' | 'published' | 'archived';

export interface VipCourseRecord {
  id: string;
  userId: string;
  slug: string;
  title: string;
  focus: string;
  coverImageUrl: string | null;
  status: VipCourseStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
}

export interface CourseWeekRecord {
  id: string;
  courseId: string;
  weekNumber: number;
  title: string;
  theme: string;
  status: VipCourseStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface MissionBlockRecord {
  id: string;
  missionId: string;
  blockType: ComponentType;
  sortOrder: number;
  config: Record<string, unknown>;
  required: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseComponentRecord {
  id: string;
  weekId: string;
  sortOrder: number;
  componentType: ComponentType;
  title: string;
  config: Record<string, unknown>;
  required: boolean;
  blocks: MissionBlockRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface VipCourseFull extends VipCourseRecord {
  weeks: Array<CourseWeekRecord & { components: CourseComponentRecord[] }>;
}

// ── Row types ──

interface VipCourseRow {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  focus: string;
  cover_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  author_username: string | null;
  author_avatar_url: string | null;
}

interface CourseWeekRow {
  id: string;
  course_id: string;
  week_number: number;
  title: string;
  theme: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface CourseComponentRow {
  id: string;
  week_id: string;
  sort_order: number;
  component_type: string;
  title: string;
  config: string;
  required: boolean;
  created_at: string;
  updated_at: string;
}

interface MissionBlockRow {
  id: string;
  mission_id: string;
  block_type: string;
  sort_order: number;
  config: string;
  required: boolean;
  created_at: string;
  updated_at: string;
}

// ── Mappers ──

function toVipCourse(row: VipCourseRow): VipCourseRecord {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    title: row.title,
    focus: row.focus,
    coverImageUrl: row.cover_image_url,
    status: (row.status as VipCourseStatus) || 'draft',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    authorName: row.author_username ?? '',
    authorAvatar: row.author_avatar_url ?? null,
  };
}

function toCourseWeek(row: CourseWeekRow): CourseWeekRecord {
  return {
    id: row.id,
    courseId: row.course_id,
    weekNumber: row.week_number,
    title: row.title,
    theme: row.theme,
    status: (row.status as VipCourseStatus) || 'draft',
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseConfig(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw !== 'string') return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toMissionBlock(row: MissionBlockRow): MissionBlockRecord {
  return {
    id: row.id,
    missionId: row.mission_id,
    blockType: (row.block_type as ComponentType) || 'rich_text',
    sortOrder: row.sort_order,
    config: parseConfig(row.config),
    required: row.required,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toCourseComponent(row: CourseComponentRow): CourseComponentRecord {
  return {
    id: row.id,
    weekId: row.week_id,
    sortOrder: row.sort_order,
    componentType: (row.component_type as ComponentType) || 'rich_text',
    title: row.title,
    config: parseConfig(row.config),
    required: row.required,
    blocks: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Courses ──

export async function getVipCourses(userId: string): Promise<VipCourseRecord[]> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<VipCourseRow[]>(
    `SELECT c.*, u.username AS author_username, u.avatar_url AS author_avatar_url
     FROM vip_courses c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.user_id = :userId
     ORDER BY c.created_at DESC`,
    { userId },
  );
  return rows.map(toVipCourse);
}

export async function getVipCourseById(id: string): Promise<VipCourseRecord | null> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<VipCourseRow[]>(
    `SELECT c.*, u.username AS author_username, u.avatar_url AS author_avatar_url
     FROM vip_courses c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.id = :id`,
    { id },
  );
  return rows[0] ? toVipCourse(rows[0]) : null;
}

export async function getVipCourseBySlug(slug: string): Promise<VipCourseRecord | null> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<VipCourseRow[]>(
    `SELECT c.*, u.username AS author_username, u.avatar_url AS author_avatar_url
     FROM vip_courses c
     LEFT JOIN users u ON u.id = c.user_id
     WHERE c.slug = :slug`,
    { slug },
  );
  return rows[0] ? toVipCourse(rows[0]) : null;
}

export async function getVipCourseFullBySlug(slug: string): Promise<VipCourseFull | null> {
  await ensureVipCourseSchema();

  const course = await getVipCourseBySlug(slug);
  if (!course) return null;
  return getVipCourseFull(course.id);
}

export async function getVipCourseFull(id: string): Promise<VipCourseFull | null> {
  await ensureVipCourseSchema();

  const [courseRows, weekRows, componentRows, blockRows] = await Promise.all([
    sqlQuery<VipCourseRow[]>(
      `SELECT c.*, u.username AS author_username, u.avatar_url AS author_avatar_url
       FROM vip_courses c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = :id`,
      { id },
    ),
    sqlQuery<CourseWeekRow[]>(
      `SELECT * FROM course_weeks WHERE course_id = :id ORDER BY sort_order ASC, week_number ASC`,
      { id },
    ),
    sqlQuery<CourseComponentRow[]>(
      `SELECT c.* FROM course_components c
       JOIN course_weeks w ON c.week_id = w.id
       WHERE w.course_id = :id
       ORDER BY c.sort_order ASC`,
      { id },
    ),
    sqlQuery<MissionBlockRow[]>(
      `SELECT mb.* FROM mission_blocks mb
       JOIN course_components c ON mb.mission_id = c.id
       JOIN course_weeks w ON c.week_id = w.id
       WHERE w.course_id = :id
       ORDER BY mb.sort_order ASC`,
      { id },
    ),
  ]);

  if (!courseRows[0]) return null;

  const blockMap = new Map<string, MissionBlockRecord[]>();
  for (const block of blockRows.map(toMissionBlock)) {
    const list = blockMap.get(block.missionId);
    if (list) list.push(block);
    else blockMap.set(block.missionId, [block]);
  }

  const componentMap = new Map<string, CourseComponentRecord[]>();
  for (const comp of componentRows.map(toCourseComponent)) {
    const compWithBlocks = { ...comp, blocks: blockMap.get(comp.id) ?? [] };
    const list = componentMap.get(comp.weekId);
    if (list) {
      list.push(compWithBlocks);
    } else {
      componentMap.set(comp.weekId, [compWithBlocks]);
    }
  }

  const weeks: Array<CourseWeekRecord & { components: CourseComponentRecord[] }> = weekRows.map((w) => ({
    ...toCourseWeek(w),
    components: componentMap.get(w.id) ?? [],
  }));

  return { ...toVipCourse(courseRows[0]), weeks };
}

export async function createVipCourse(input: {
  userId: string;
  slug: string;
  title: string;
  focus?: string;
  coverImageUrl?: string | null;
}): Promise<VipCourseRecord> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<VipCourseRow[]>(
    `INSERT INTO vip_courses (user_id, slug, title, focus, cover_image_url)
     VALUES (:userId, :slug, :title, :focus, :coverImageUrl)
     RETURNING *`,
    { ...input, focus: input.focus ?? '', coverImageUrl: input.coverImageUrl ?? null },
  );
  return toVipCourse(rows[0]);
}

export async function updateVipCourse(
  id: string,
  input: Partial<{
    slug: string;
    title: string;
    focus: string;
    coverImageUrl: string | null;
    status: VipCourseStatus;
  }>,
): Promise<VipCourseRecord | null> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<VipCourseRow[]>(
    `UPDATE vip_courses
     SET slug = COALESCE(:slug, slug),
         title = COALESCE(:title, title),
         focus = COALESCE(:focus, focus),
         cover_image_url = COALESCE(:coverImageUrl, cover_image_url),
         status = COALESCE(:status, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = :id
     RETURNING *`,
    { id, ...input },
  );
  return rows[0] ? toVipCourse(rows[0]) : null;
}

export async function deleteVipCourse(id: string): Promise<boolean> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM vip_courses WHERE id = :id RETURNING id`,
    { id },
  );
  return rows.length > 0;
}

// ── Weeks ──

export async function createCourseWeek(input: {
  courseId: string;
  weekNumber: number;
  title: string;
  theme?: string;
  sortOrder?: number;
}): Promise<CourseWeekRecord> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<CourseWeekRow[]>(
    `INSERT INTO course_weeks (course_id, week_number, title, theme, sort_order)
     VALUES (:courseId, :weekNumber, :title, :theme, :sortOrder)
     RETURNING *`,
    { ...input, theme: input.theme ?? '', sortOrder: input.sortOrder ?? input.weekNumber },
  );
  return toCourseWeek(rows[0]);
}

export async function updateCourseWeek(
  id: string,
  input: Partial<{
    title: string;
    theme: string;
    weekNumber: number;
    status: VipCourseStatus;
    sortOrder: number;
  }>,
): Promise<CourseWeekRecord | null> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<CourseWeekRow[]>(
    `UPDATE course_weeks
     SET title = COALESCE(:title, title),
         theme = COALESCE(:theme, theme),
         week_number = COALESCE(:weekNumber, week_number),
         status = COALESCE(:status, status),
         sort_order = COALESCE(:sortOrder, sort_order),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = :id
     RETURNING *`,
    { id, ...input },
  );
  return rows[0] ? toCourseWeek(rows[0]) : null;
}

export async function deleteCourseWeek(id: string): Promise<boolean> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM course_weeks WHERE id = :id RETURNING id`,
    { id },
  );
  return rows.length > 0;
}

// ── Components ──

export async function createCourseComponent(input: {
  weekId: string;
  componentType: ComponentType;
  title?: string;
  config?: Record<string, unknown>;
  sortOrder?: number;
  required?: boolean;
}): Promise<CourseComponentRecord> {
  await ensureVipCourseSchema();

  const nextOrder = input.sortOrder ?? await getNextComponentSortOrder(input.weekId);

  const rows = await sqlQuery<CourseComponentRow[]>(
    `INSERT INTO course_components (week_id, sort_order, component_type, title, config, required)
     VALUES (:weekId, :sortOrder, :componentType, :title, :config, :required)
     RETURNING *`,
    {
      weekId: input.weekId,
      sortOrder: nextOrder,
      componentType: input.componentType,
      title: input.title ?? '',
      config: JSON.stringify(input.config ?? {}),
      required: input.required ?? false,
    },
  );
  return toCourseComponent(rows[0]);
}

async function getNextComponentSortOrder(weekId: string): Promise<number> {
  const rows = await sqlQuery<Array<{ max_order: number | null }>>(
    `SELECT MAX(sort_order) AS max_order FROM course_components WHERE week_id = :weekId`,
    { weekId },
  );
  return (rows[0]?.max_order ?? -1) + 1;
}

export async function updateCourseComponent(
  id: string,
  input: Partial<{
    componentType: ComponentType;
    title: string;
    config: Record<string, unknown>;
    sortOrder: number;
    required: boolean;
  }>,
): Promise<CourseComponentRecord | null> {
  await ensureVipCourseSchema();

  const setClauses: string[] = ['updated_at = CURRENT_TIMESTAMP'];
  const params: Record<string, unknown> = { id };

  if (input.componentType !== undefined) {
    setClauses.push('component_type = :componentType');
    params.componentType = input.componentType;
  }
  if (input.title !== undefined) {
    setClauses.push('title = :title');
    params.title = input.title;
  }
  if (input.config !== undefined) {
    setClauses.push('config = :config');
    params.config = JSON.stringify(input.config);
  }
  if (input.sortOrder !== undefined) {
    setClauses.push('sort_order = :sortOrder');
    params.sortOrder = input.sortOrder;
  }
  if (input.required !== undefined) {
    setClauses.push('required = :required');
    params.required = input.required;
  }

  const rows = await sqlQuery<CourseComponentRow[]>(
    `UPDATE course_components SET ${setClauses.join(', ')} WHERE id = :id RETURNING *`,
    params,
  );
  return rows[0] ? toCourseComponent(rows[0]) : null;
}

export async function deleteCourseComponent(id: string): Promise<boolean> {
  await ensureVipCourseSchema();
  const rows = await sqlQuery<Array<{ id: string }>>(
    `DELETE FROM course_components WHERE id = :id RETURNING id`,
    { id },
  );
  return rows.length > 0;
}

export async function replaceCourseContent(
  courseId: string,
  weeks: Array<{
    weekNumber: number;
    title: string;
    theme: string;
    sortOrder: number;
    components: Array<{
      componentType: ComponentType;
      title: string;
      config: Record<string, unknown>;
      sortOrder: number;
      required: boolean;
      blocks?: Array<{
        blockType: ComponentType;
        config: Record<string, unknown>;
        sortOrder: number;
        required: boolean;
      }>;
    }>;
  }>,
): Promise<VipCourseFull> {
  await ensureVipCourseSchema();

  return withTransaction(async (client) => {
    // Delete existing weeks (components cascade via FK to both course_components and mission_blocks)
    await client.query('DELETE FROM course_weeks WHERE course_id = $1', [courseId]);

    // Re-insert weeks and components
    for (const week of weeks) {
      const weekResult = await client.query(
        `INSERT INTO course_weeks (course_id, week_number, title, theme, sort_order)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [courseId, week.weekNumber, week.title, week.theme, week.sortOrder],
      );
      const weekId = weekResult.rows[0].id;

      if (week.components.length > 0) {
        const compValueClauses: string[] = [];
        const compParams: unknown[] = [];
        let paramIndex = 1;

        for (const comp of week.components) {
          compValueClauses.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}) RETURNING id`);
          compParams.push(weekId, comp.sortOrder, comp.componentType, comp.title, JSON.stringify(comp.config), comp.required);
          paramIndex += 6;
        }

        const compResults = await client.query(
          `INSERT INTO course_components (week_id, sort_order, component_type, title, config, required)
           VALUES ${compValueClauses.map((c, i) => c.replace(' RETURNING id', '')).join(', ')}
           RETURNING id`,
          compParams,
        );

        // Insert blocks for each component
        for (let ci = 0; ci < week.components.length; ci++) {
          const comp = week.components[ci];
          const compId = compResults.rows[ci]?.id;
          if (comp.blocks && comp.blocks.length > 0 && compId) {
            const blockValueClauses: string[] = [];
            const blockParams: unknown[] = [];
            let blockParamIndex = 1;

            for (const block of comp.blocks) {
              blockValueClauses.push(`($${blockParamIndex}, $${blockParamIndex + 1}, $${blockParamIndex + 2}, $${blockParamIndex + 3}, $${blockParamIndex + 4})`);
              blockParams.push(compId, block.sortOrder, block.blockType, JSON.stringify(block.config), block.required);
              blockParamIndex += 5;
            }

            await client.query(
              `INSERT INTO mission_blocks (mission_id, sort_order, block_type, config, required)
               VALUES ${blockValueClauses.join(', ')}`,
              blockParams,
            );
          }
        }
      }
    }

    // Return the full course
    const courseRows = await client.query(
      `SELECT c.*, u.username AS author_username, u.avatar_url AS author_avatar_url
       FROM vip_courses c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = $1`,
      [courseId],
    );

    if (!courseRows.rows[0]) {
      throw new Error('Course not found after content replacement');
    }

    const weekRows = await client.query(
      `SELECT * FROM course_weeks WHERE course_id = $1 ORDER BY sort_order ASC, week_number ASC`,
      [courseId],
    );

    const compRows = await client.query(
      `SELECT c.* FROM course_components c
       JOIN course_weeks w ON c.week_id = w.id
       WHERE w.course_id = $1
       ORDER BY c.sort_order ASC`,
      [courseId],
    );

    const blockRows = await client.query(
      `SELECT mb.* FROM mission_blocks mb
       JOIN course_components c ON mb.mission_id = c.id
       JOIN course_weeks w ON c.week_id = w.id
       WHERE w.course_id = $1
       ORDER BY mb.sort_order ASC`,
      [courseId],
    );

    const blockMap = new Map<string, MissionBlockRecord[]>();
    for (const block of blockRows.rows.map(toMissionBlock)) {
      const list = blockMap.get(block.missionId);
      if (list) list.push(block);
      else blockMap.set(block.missionId, [block]);
    }

    const componentMap = new Map<string, CourseComponentRecord[]>();
    for (const comp of compRows.rows.map(toCourseComponent)) {
      const compWithBlocks = { ...comp, blocks: blockMap.get(comp.id) ?? [] };
      const list = componentMap.get(comp.weekId);
      if (list) {
        list.push(compWithBlocks);
      } else {
        componentMap.set(comp.weekId, [compWithBlocks]);
      }
    }

    const mappedWeeks = weekRows.rows.map((w: CourseWeekRow) => ({
      ...toCourseWeek(w),
      components: componentMap.get(w.id) ?? [],
    }));

    return { ...toVipCourse(courseRows.rows[0] as VipCourseRow), weeks: mappedWeeks };
  });
}

export async function reorderCourseComponents(
  weekId: string,
  orderedIds: string[],
): Promise<CourseComponentRecord[]> {
  await ensureVipCourseSchema();

  if (orderedIds.length === 0) return [];

  const whenClauses = orderedIds.map((_, i) => `WHEN $${i + 1} THEN ${i}`).join(' ');
  const params: unknown[] = [...orderedIds, weekId];

  await sqlQuery(
    `UPDATE course_components
     SET sort_order = CASE id ${whenClauses} ELSE sort_order END,
         updated_at = CURRENT_TIMESTAMP
     WHERE week_id = $${orderedIds.length + 1}`,
    params,
  );

  const rows = await sqlQuery<CourseComponentRow[]>(
    `SELECT * FROM course_components WHERE week_id = :weekId ORDER BY sort_order ASC`,
    { weekId },
  );
  return rows.map(toCourseComponent);
}
