import { Pool } from 'pg';

const LOCAL_SUPABASE_URL = 'postgresql://postgres:postgres@localhost:54322/postgres';

export async function setup() {
  if (process.env.TEST_DATABASE_URL) return;

  try {
    const pool = new Pool({
      connectionString: LOCAL_SUPABASE_URL,
      max: 1,
      connectionTimeoutMillis: 2000,
    });
    await pool.query('SELECT 1');
    await pool.end();
    process.env.TEST_DATABASE_URL = LOCAL_SUPABASE_URL;
  } catch {
    // No local Supabase stack — tests will self-skip via describe.skipIf
  }
}
