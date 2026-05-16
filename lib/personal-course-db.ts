import { sqlQuery } from './db';
import { ensurePersonalCourseSchema } from './ensurePersonalCourseSchema';
import type {
  CourseData,
  CourseStatus,
  IntakeAnswers,
  PersonalCourseRecord,
} from './personal-course';

interface CourseRow {
  id: string;
  status: string;
  intake_data: unknown;
  course_data: unknown;
  progress_data: unknown;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function mapRow(row: CourseRow): PersonalCourseRecord {
  const courseData = parseJson<CourseData | Record<string, never>>(row.course_data, {});
  const hasCourse = courseData && typeof courseData === 'object' && 'weeks' in courseData;
  return {
    id: row.id,
    status: (row.status as CourseStatus) || 'intake',
    intakeData: parseJson<IntakeAnswers>(row.intake_data, {}),
    courseData: hasCourse ? (courseData as CourseData) : null,
    progressData: parseJson<Record<string, unknown>>(row.progress_data, {}),
  };
}

export async function getPersonalCourse(userId: string): Promise<PersonalCourseRecord | null> {
  await ensurePersonalCourseSchema();
  const rows = await sqlQuery<CourseRow[]>(
    `SELECT id, status, intake_data, course_data, progress_data
     FROM personal_courses WHERE user_id = :userId LIMIT 1`,
    { userId }
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function saveIntake(userId: string, intake: IntakeAnswers): Promise<PersonalCourseRecord> {
  await ensurePersonalCourseSchema();
  const rows = await sqlQuery<CourseRow[]>(
    `INSERT INTO personal_courses (user_id, status, intake_data)
     VALUES (:userId, 'intake', :intake)
     ON CONFLICT (user_id) DO UPDATE
       SET intake_data = :intake,
           status = CASE WHEN personal_courses.status = 'ready' THEN 'ready' ELSE 'intake' END
     RETURNING id, status, intake_data, course_data, progress_data`,
    { userId, intake: JSON.stringify(intake) }
  );
  return mapRow(rows[0]);
}

export async function markGenerating(userId: string): Promise<void> {
  await ensurePersonalCourseSchema();
  await sqlQuery(
    `UPDATE personal_courses SET status = 'generating' WHERE user_id = :userId`,
    { userId }
  );
}

export async function saveGeneratedCourse(userId: string, courseData: CourseData): Promise<PersonalCourseRecord> {
  await ensurePersonalCourseSchema();
  const rows = await sqlQuery<CourseRow[]>(
    `UPDATE personal_courses
       SET status = 'ready', course_data = :courseData
     WHERE user_id = :userId
     RETURNING id, status, intake_data, course_data, progress_data`,
    { userId, courseData: JSON.stringify(courseData) }
  );
  if (!rows.length) {
    throw new Error('No personal course row to update');
  }
  return mapRow(rows[0]);
}

export async function saveProgress(
  userId: string,
  progressData: Record<string, unknown>
): Promise<void> {
  await ensurePersonalCourseSchema();
  await sqlQuery(
    `UPDATE personal_courses SET progress_data = :progressData WHERE user_id = :userId`,
    { userId, progressData: JSON.stringify(progressData) }
  );
}
