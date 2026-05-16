import { sqlQuery } from './db';

declare global {
  // eslint-disable-next-line no-var
  var __mwaPersonalCourseSchemaEnsured: boolean | undefined;
}

export async function ensurePersonalCourseSchema() {
  if (globalThis.__mwaPersonalCourseSchemaEnsured) return;

  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS personal_courses (
      id CHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id CHAR(36) NOT NULL,
      status VARCHAR(16) NOT NULL DEFAULT 'intake',
      intake_data JSONB NOT NULL DEFAULT '{}',
      course_data JSONB NOT NULL DEFAULT '{}',
      progress_data JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (user_id)
    )
  `);

  try {
    await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_personal_courses_user_id ON personal_courses(user_id)`);
  } catch {
    // index may already exist
  }

  try {
    await sqlQuery(`DROP TRIGGER IF EXISTS update_personal_courses_updated_at ON personal_courses`);
    await sqlQuery(`
      CREATE TRIGGER update_personal_courses_updated_at BEFORE UPDATE ON personal_courses
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()
    `);
  } catch {
    // trigger function may not exist in this environment
  }

  globalThis.__mwaPersonalCourseSchemaEnsured = true;
}
