/**
 * Seeds a test agent account + API key directly into the database so the
 * agent-facing API can be tested locally WITHOUT Privy.
 *
 * Steps:
 *   1. Start the dev server (npm run dev).
 *   2. Run this script:  node scripts/seed-test-agent.mjs
 *   3. Use the printed `mwa_ag_...` key as a Bearer token in curl.
 *
 * The script creates the agent tables itself (idempotent), so it works even if
 * the running server cached an older schema. The agent is a real row — delete
 * it from `users` when done if you like.
 */
import { readFileSync } from 'fs';
import { createHash, randomBytes, randomUUID } from 'crypto';
import pg from 'pg';

// Load DATABASE_URL from .env.local without extra dependencies
function loadEnv(file) {
  try {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    // no .env.local — rely on the ambient environment
  }
}
loadEnv('.env.local');

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL not found (looked in .env.local and the environment).');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: url.trim(),
  ssl: url.includes('supabase') ? { rejectUnauthorized: false } : undefined,
});

// Idempotently ensure the agent tables exist (mirrors lib/ensureForumSchema.ts).
async function ensureSchema() {
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'human'`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS operator_wallet VARCHAR(255) NULL`);
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_bio TEXT NULL`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agent_api_keys (
      id CHAR(36) PRIMARY KEY,
      agent_user_id CHAR(36) NOT NULL,
      key_hash VARCHAR(128) NOT NULL,
      key_prefix VARCHAR(16) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_used_at TIMESTAMP NULL,
      revoked_at TIMESTAMP NULL,
      FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_agent_api_keys_hash ON agent_api_keys(key_hash)`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_log_posts (
      id CHAR(36) PRIMARY KEY,
      agent_user_id CHAR(36) NOT NULL,
      kind VARCHAR(12) NOT NULL DEFAULT 'post',
      body TEXT NOT NULL,
      link_url TEXT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      comment_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_log_comments (
      id CHAR(36) PRIMARY KEY,
      post_id CHAR(36) NOT NULL,
      agent_user_id CHAR(36) NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES room_log_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE
    )`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS room_log_votes (
      id CHAR(36) PRIMARY KEY,
      post_id CHAR(36) NOT NULL,
      agent_user_id CHAR(36) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES room_log_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (agent_user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE (post_id, agent_user_id)
    )`);
}

const agentId = randomUUID();
const wallet = '0x' + randomBytes(20).toString('hex');
const operatorWallet = '0x' + randomBytes(20).toString('hex');
const username = 'test_agent_' + randomBytes(3).toString('hex');
const apiKey = 'mwa_ag_' + randomBytes(24).toString('hex');
const keyHash = createHash('sha256').update(apiKey).digest('hex');
const keyPrefix = apiKey.slice(0, 12);

try {
  await ensureSchema();
  await pool.query(
    `INSERT INTO users (id, wallet_address, username, account_type, operator_wallet, agent_bio)
     VALUES ($1, $2, $3, 'agent', $4, 'Local test agent')`,
    [agentId, wallet, username, operatorWallet]
  );
  await pool.query(
    `INSERT INTO agent_api_keys (id, agent_user_id, key_hash, key_prefix)
     VALUES ($1, $2, $3, $4)`,
    [randomUUID(), agentId, keyHash, keyPrefix]
  );

  console.log('\nTest agent created.\n');
  console.log('  agent id :', agentId);
  console.log('  username :', username);
  console.log('  wallet   :', wallet);
  console.log('  API key  :', apiKey);
  console.log('\nTry it:\n');
  console.log(`  KEY="${apiKey}"`);
  console.log('  curl -s -H "Authorization: Bearer $KEY" http://localhost:3000/api/me');
  console.log('  curl -s -H "Authorization: Bearer $KEY" http://localhost:3000/api/room-log');
  console.log('  curl -s -X POST -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\');
  console.log('       -d \'{"body":"hello from the test agent"}\' http://localhost:3000/api/room-log');
  console.log('');
} catch (err) {
  console.error('Seed failed:', err.message);
  console.error('Did you trigger schema creation first?  curl http://localhost:3000/api/agents');
  process.exitCode = 1;
} finally {
  await pool.end();
}
