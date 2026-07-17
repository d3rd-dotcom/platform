import { beforeEach, describe, expect, it, vi } from 'vitest';

const sqlQuery = vi.hoisted(() => vi.fn());

vi.mock('@/lib/db', () => ({ sqlQuery }));

import { ensureReadingCommentsSchema } from '@/lib/ensureReadingCommentsSchema';

describe('reading comments schema convergence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlQuery.mockResolvedValue([]);
    globalThis.__mwaReadingCommentsSchemaEnsured = undefined;
    globalThis.__mwaReadingCommentsSchemaLock = undefined;
  });

  it('never drops or rewrites live comment tables during a request', async () => {
    await ensureReadingCommentsSchema();

    const statements = sqlQuery.mock.calls.map(([statement]) => String(statement));
    expect(statements.some((statement) => /\bDROP\s+TABLE\b/i.test(statement))).toBe(false);
    expect(statements.some((statement) => /ALTER\s+COLUMN[\s\S]+TYPE/i.test(statement))).toBe(false);
    expect(statements.some((statement) => /CREATE TABLE IF NOT EXISTS reading_comments/i.test(statement))).toBe(true);
    expect(statements.some((statement) => /CREATE TABLE IF NOT EXISTS reading_comment_likes/i.test(statement))).toBe(true);
  });
});
