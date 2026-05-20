import { sqlQuery } from './db';

export async function ensureGeneratedTestsSchema() {
  await sqlQuery(`
    CREATE TABLE IF NOT EXISTS generated_tests (
      id CHAR(36) PRIMARY KEY,
      user_id CHAR(36) NULL,
      difficulty INTEGER NOT NULL,
      persona VARCHAR(80) NOT NULL,
      title VARCHAR(80) NOT NULL,
      shard_reward INTEGER NOT NULL,
      source VARCHAR(32) NOT NULL,
      questions JSONB NULL,
      answers JSONB NULL,
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Backfill columns on tables created before answer collection existed.
  await sqlQuery(`ALTER TABLE generated_tests ADD COLUMN IF NOT EXISTS questions JSONB`);
  await sqlQuery(`ALTER TABLE generated_tests ADD COLUMN IF NOT EXISTS answers JSONB`);

  await sqlQuery(`CREATE INDEX IF NOT EXISTS idx_generated_tests_user_id ON generated_tests(user_id)`);
}
