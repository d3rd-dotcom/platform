import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaVipCourseSchemaEnsured: boolean | undefined;
  // eslint-disable-next-line no-var
  var __mwaVipCourseSchemaLock: Promise<void> | undefined;
}

export async function ensureVipCourseSchema() {
  if (globalThis.__mwaVipCourseSchemaEnsured) return;
  if (globalThis.__mwaVipCourseSchemaLock) {
    await globalThis.__mwaVipCourseSchemaLock;
    return;
  }

  const lockPromise = (async () => {
    try {
      await sqlQuery(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    } catch (err: any) {
      if (err?.code === 'ECONNREFUSED' || err?.code === 'ENOTFOUND' || err?.code === 'ETIMEDOUT') {
        throw err;
      }
    }

    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS vip_courses (
        id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id VARCHAR(36) NOT NULL,
        slug VARCHAR(128) NOT NULL,
        title VARCHAR(255) NOT NULL,
        focus VARCHAR(128) NOT NULL DEFAULT '',
        cover_image_url TEXT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS course_weeks (
        id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        course_id CHAR(36) NOT NULL,
        week_number INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        theme VARCHAR(255) NOT NULL DEFAULT '',
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES vip_courses(id) ON DELETE CASCADE,
        UNIQUE (course_id, week_number)
      )
    `);

    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS course_components (
        id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        week_id CHAR(36) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        component_type VARCHAR(32) NOT NULL,
        title VARCHAR(255) NOT NULL DEFAULT '',
        config JSONB NOT NULL DEFAULT '{}',
        required BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (week_id) REFERENCES course_weeks(id) ON DELETE CASCADE
      )
    `);

    await sqlQuery(`
      CREATE TABLE IF NOT EXISTS mission_blocks (
        id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        mission_id CHAR(36) NOT NULL,
        block_type VARCHAR(32) NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        config JSONB NOT NULL DEFAULT '{}',
        required BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (mission_id) REFERENCES course_components(id) ON DELETE CASCADE
      )
    `);

    try {
      await sqlQuery(`ALTER TABLE vip_courses DROP CONSTRAINT IF EXISTS vip_courses_slug_unique`);
      await sqlQuery(`ALTER TABLE vip_courses ADD CONSTRAINT vip_courses_slug_unique UNIQUE (slug)`);
      await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_vip_courses_user ON vip_courses(user_id, status)`);
      await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_course_weeks_course ON course_weeks(course_id, sort_order)`);
      await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_course_components_week ON course_components(week_id, sort_order)`);
      await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_mission_blocks_mission ON mission_blocks(mission_id, sort_order)`);
    } catch {
      // indexes are best-effort
    }

    globalThis.__mwaVipCourseSchemaEnsured = true;
  })();

  globalThis.__mwaVipCourseSchemaLock = lockPromise;
  try {
    await lockPromise;
  } finally {
    globalThis.__mwaVipCourseSchemaLock = undefined;
  }
}
