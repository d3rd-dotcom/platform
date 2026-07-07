/**
 * Grant verifier_credentials rows outside the test-passing path (earned_via
 * 'seed'). Bootstraps the guide-verification jury pool — at launch nobody has
 * passed a verifier test yet, so submitGuideForVerification() in
 * lib/guide-verification-db.ts has no one to draw a panel from and every
 * first submission dead-ends on "No eligible verifiers hold a credential for
 * this guide's subject(s) yet." This script lets James manually seat trusted
 * verifiers (himself, staff, early contributors) for specific subjects so the
 * jury system has a pool to draw from.
 *
 * Idempotent: ON CONFLICT (user_id, subject) DO NOTHING, matching the unique
 * constraint in supabase/migrations/20260705090100_guide_verification.sql.
 * Re-running with the same user+subject is a no-op — it will NOT raise an
 * existing credential's max_level. To raise a level, have the user pass the
 * tiered verifier test (lib/verifier-tests-db.ts), which upgrades in place.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts \
 *     --user=<id|email|wallet> --subject="Anxiety" --subject="Sleep hygiene" [--max-level=5]
 *
 *   npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts \
 *     --user=james@example.com --subjects="Anxiety,Sleep hygiene,Boundaries"
 *
 *   npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --list
 *   npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --list --subject="Anxiety"
 *
 * --user accepts a user id (UUID), an email, or a wallet address — whichever
 * you have on hand. Detected automatically: '@' -> email, '0x' + 40 hex -> wallet,
 * else treated as an id.
 * --subject may be repeated for multiple subjects in one run; --subjects is a
 * comma-separated shorthand for the same thing.
 * --max-level defaults to 5 (MAX_LEVEL, the top tier reachable via the test path)
 * so a seeded verifier is fully qualified for the subject out of the gate.
 */
import { isDbConfigured, sqlQuery } from '../lib/db';
import { normalizeSubject, normalizeLevel, MAX_LEVEL } from '../lib/verifier-tests-db';

const EARNED_VIA = 'seed';

interface UserRow {
  id: string;
  username: string;
  email: string;
  wallet_address: string | null;
}

interface CredentialRow {
  subject: string;
  max_level: number;
  earned_via: string;
  username: string;
  email: string;
}

function getArg(name: string): string | undefined {
  const flag = `--${name}=`;
  const found = process.argv.find((a) => a.startsWith(flag));
  return found ? found.slice(flag.length) : undefined;
}

function getRepeatedArg(name: string): string[] {
  const flag = `--${name}=`;
  return process.argv.filter((a) => a.startsWith(flag)).map((a) => a.slice(flag.length));
}

function isWalletAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

async function resolveUser(identifier: string): Promise<UserRow> {
  let rows: UserRow[];
  if (identifier.includes('@')) {
    rows = await sqlQuery<UserRow[]>(
      `SELECT id, username, email, wallet_address FROM users WHERE email = :email LIMIT 1`,
      { email: identifier.toLowerCase().trim() },
    );
  } else if (isWalletAddress(identifier)) {
    rows = await sqlQuery<UserRow[]>(
      `SELECT id, username, email, wallet_address FROM users WHERE wallet_address = :wallet LIMIT 1`,
      { wallet: identifier },
    );
  } else {
    rows = await sqlQuery<UserRow[]>(
      `SELECT id, username, email, wallet_address FROM users WHERE id = :id LIMIT 1`,
      { id: identifier },
    );
  }
  if (!rows[0]) {
    throw new Error(`No user found for identifier: ${identifier}`);
  }
  return rows[0];
}

async function listCredentials(subjectFilter?: string): Promise<void> {
  const rows = await sqlQuery<CredentialRow[]>(
    subjectFilter
      ? `SELECT vc.subject, vc.max_level, vc.earned_via, u.username, u.email
         FROM verifier_credentials vc
         JOIN users u ON u.id = vc.user_id
         WHERE vc.subject = :subject
         ORDER BY vc.subject ASC, vc.max_level DESC, u.username ASC`
      : `SELECT vc.subject, vc.max_level, vc.earned_via, u.username, u.email
         FROM verifier_credentials vc
         JOIN users u ON u.id = vc.user_id
         ORDER BY vc.subject ASC, vc.max_level DESC, u.username ASC`,
    subjectFilter ? { subject: normalizeSubject(subjectFilter) } : {},
  );

  if (rows.length === 0) {
    console.log(subjectFilter ? `No verifiers hold a credential for "${subjectFilter}".` : 'No verifier credentials exist yet.');
    return;
  }

  const bySubject = new Map<string, CredentialRow[]>();
  for (const row of rows) {
    const list = bySubject.get(row.subject) ?? [];
    list.push(row);
    bySubject.set(row.subject, list);
  }

  for (const [subject, holders] of bySubject) {
    console.log(`\n${subject} (${holders.length} verifier${holders.length === 1 ? '' : 's'}):`);
    for (const holder of holders) {
      console.log(`  @${holder.username}  <${holder.email}>  level ${holder.max_level}  via ${holder.earned_via}`);
    }
  }
}

async function main() {
  if (!isDbConfigured()) {
    console.error('Database is not configured.');
    process.exit(1);
  }

  const list = process.argv.includes('--list');
  const subjectFilter = getArg('subject');

  if (list) {
    await listCredentials(subjectFilter);
    return;
  }

  const userIdentifier = getArg('user');
  if (!userIdentifier) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --user=<id|email|wallet> --subject="X" [--subject="Y"] [--max-level=5]');
    console.error('   or: npx tsx --env-file=.env.local scripts/seed-verifier-credentials.ts --list [--subject="X"]');
    process.exit(1);
  }

  const subjectsArg = getRepeatedArg('subject');
  const subjectsCsv = getArg('subjects');
  const rawSubjects = [
    ...subjectsArg,
    ...(subjectsCsv ? subjectsCsv.split(',') : []),
  ].map((s) => s.trim()).filter(Boolean);

  if (rawSubjects.length === 0) {
    console.error('At least one --subject="X" (or --subjects="A,B,C") is required.');
    process.exit(1);
  }

  const maxLevelArg = getArg('max-level');
  const maxLevel = normalizeLevel(maxLevelArg !== undefined ? maxLevelArg : MAX_LEVEL);

  const user = await resolveUser(userIdentifier);
  console.log(`Seeding credentials for @${user.username} (${user.id}, ${user.email})`);

  for (const rawSubject of rawSubjects) {
    const subject = normalizeSubject(rawSubject);
    const rows = await sqlQuery<Array<{ subject: string; max_level: number }>>(
      `INSERT INTO verifier_credentials (user_id, subject, max_level, earned_via)
       VALUES (:userId, :subject, :maxLevel, :earnedVia)
       ON CONFLICT (user_id, subject) DO NOTHING
       RETURNING subject, max_level`,
      { userId: user.id, subject, maxLevel, earnedVia: EARNED_VIA },
    );
    if (rows[0]) {
      console.log(`  granted  ${subject}  level ${rows[0].max_level}`);
    } else {
      console.log(`  skipped  ${subject}  (already holds a credential for this subject)`);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error seeding verifier credentials:', err);
  process.exit(1);
});
