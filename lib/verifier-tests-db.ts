import { sqlQuery, withTransaction, sqlQueryWithClient } from './db';
import { ensureGeneratedTestsSchema } from './ensureGeneratedTestsSchema';
import { clampTestDifficulty, getTestShardReward, MIN_SHORT_ANSWER_CHARS } from './test-rewards';

/**
 * Phase 7 — Tiered Verifier Testing data access.
 *
 * A "verifier test" is an ordinary AI-generated test row (the same
 * `generated_tests` table + generation conventions used by
 * `app/api/generate-test/`) that is TAGGED for verifier qualification:
 *   generated_tests.purpose  = 'verifier_qualification'
 *   generated_tests.metadata = { subject, level }
 * (columns added by db/migration-verifier-tests.sql — purely additive).
 *
 * On a passing grade (>= PASS_THRESHOLD) we upsert a `verifier_credentials`
 * row (from db/migration-guide-verification.sql — schema left untouched) so the
 * user may sit on verification panels for that subject up to the tested level.
 *
 * This module does NOT edit lib/guides-db.ts / lib/guide-*.ts. It only reads and
 * writes `generated_tests` and `verifier_credentials`.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const VERIFIER_TEST_PURPOSE = 'verifier_qualification';

/** Pass mark, in percent. Matches the plan: "on pass (>= 80%)". */
export const PASS_THRESHOLD = 80;

/** Difficulty band per requested level. Higher levels → harder generated test. */
const DIFFICULTY_BY_LEVEL = [90, 110, 130, 150, 175, 200];

export const MIN_SUBJECT_LENGTH = 2;
export const MAX_SUBJECT_LENGTH = 120;
export const MAX_LEVEL = 5;

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerifierCredential {
  subject: string;
  maxLevel: number;
  earnedVia: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerifierTestRequest {
  testId: string;
  subject: string;
  level: number;
  difficulty: number;
  title: string;
  intro: string;
  questions: VerifierTestQuestion[];
}

export interface VerifierTestQuestion {
  id: number;
  type: 'multiple_choice' | 'short_answer' | 'scale';
  category: string;
  question: string;
  options?: string[];
}

export interface GradeResult {
  testId: string;
  subject: string;
  level: number;
  score: number;
  passed: boolean;
  passThreshold: number;
  credential: VerifierCredential | null;
}

interface AnswersMap {
  [questionId: string]: unknown;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function httpError(message: string, status: number): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

export function normalizeSubject(input: unknown): string {
  const subject = typeof input === 'string' ? input.trim().replace(/\s+/g, ' ') : '';
  if (subject.length < MIN_SUBJECT_LENGTH) {
    throw httpError('A subject of at least 2 characters is required.', 400);
  }
  return subject.slice(0, MAX_SUBJECT_LENGTH);
}

export function normalizeLevel(input: unknown): number {
  const level = Math.trunc(Number(input));
  if (!Number.isFinite(level) || level < 0 || level > MAX_LEVEL) {
    throw httpError(`level must be an integer between 0 and ${MAX_LEVEL}.`, 400);
  }
  return level;
}

function difficultyForLevel(level: number): number {
  const raw = DIFFICULTY_BY_LEVEL[Math.min(level, DIFFICULTY_BY_LEVEL.length - 1)] ?? 130;
  return clampTestDifficulty(raw);
}

// ── AI generation (reuses the generate-test flow's conventions) ──────────────

const SYSTEM_PROMPT = `You are Blue, a scientist and researcher at Mental Wealth Academy Research Labs. Generate a rigorous VERIFIER QUALIFICATION test that decides whether a candidate is competent to review and approve community guides on a given subject at a given difficulty level.

Return ONLY valid JSON — no markdown fences, no explanation, no extra text. Match this schema exactly:

{
  "title": "short test title (max 40 characters)",
  "intro": "1-2 sentences in Blue's voice. Direct, no fluff. Tell the candidate this test qualifies them to verify guides on the subject.",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "category": "CATEGORY NAME",
      "question": "the question text",
      "options": ["option A text", "option B text", "option C text", "option D text"]
    }
  ]
}

Rules:
- Generate exactly 8 questions, all about the SUBJECT provided
- Question mix: 5 short_answer (omit options field), 2 multiple_choice (4 options each), 1 scale (omit options field)
- Questions must probe genuine subject competence and reviewing judgment (spotting errors, scope, prerequisite soundness) — not personality
- Difficulty 90=accessible, 130=college level, 200=expert complexity — scale vocabulary, abstraction, and conceptual depth to the requested level
- For short_answer: open-ended and specific, demanding a reflective, evidenced response of at least 100 characters
- For scale questions: 1-5 scale (1=never, 5=always)
- For multiple_choice: options should be meaningfully distinct, not trick answers
- No markdown in any field value`;

interface GeneratedTest {
  title: string;
  intro: string;
  questions: VerifierTestQuestion[];
}

function tryParseJson(raw: string): unknown | null {
  const stripped = raw.trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try { return JSON.parse(stripped.slice(first, last + 1)); } catch { /* fall through */ }
    }
    return null;
  }
}

function isValidGeneratedTest(value: unknown): value is GeneratedTest {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<GeneratedTest>;
  if (typeof data.title !== 'string' || typeof data.intro !== 'string' || !Array.isArray(data.questions)) {
    return false;
  }
  return data.questions.length === 8 && data.questions.every((question, index) => {
    if (!question || typeof question !== 'object') return false;
    const q = question as Partial<VerifierTestQuestion>;
    if (typeof q.id !== 'number' || q.id !== index + 1) return false;
    if (!['multiple_choice', 'short_answer', 'scale'].includes(String(q.type))) return false;
    if (typeof q.category !== 'string' || typeof q.question !== 'string') return false;
    if (q.type === 'multiple_choice') {
      return Array.isArray(q.options) && q.options.length === 4 && q.options.every((o) => typeof o === 'string');
    }
    return q.options === undefined || q.options.length === 0;
  });
}

function buildUserPrompt(subject: string, level: number, difficulty: number): string {
  return `Generate a verifier qualification test for:
- Subject: ${subject}
- Verifier level: ${level}
- Difficulty: ${difficulty}/200

Every question must be about "${subject}". Scale complexity to difficulty ${difficulty}.
Return the JSON only.`;
}

async function callOpenRouter(userPrompt: string): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error('OPENROUTER_API_KEY not configured');
  const model = process.env.OPENROUTER_TEST_MODEL || process.env.OPENROUTER_MODEL || 'openrouter/free';
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openRouterKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://mentalwealthacademy.world',
      'X-OpenRouter-Title': 'Mental Wealth Academy',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });
  const responseText = await response.text();
  let data: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } } | null = null;
  try { data = JSON.parse(responseText); } catch { /* gateway may return non-JSON */ }
  if (!response.ok) {
    throw new Error(data?.error?.message || responseText || `OpenRouter error: ${response.status}`);
  }
  const rawText = data?.choices?.[0]?.message?.content;
  if (!rawText) throw new Error('OpenRouter returned empty response');
  return rawText;
}

/**
 * Deterministic fallback verifier test — subject-parameterised so a request
 * never hard-fails when the AI provider is unavailable (mirrors the fallback in
 * app/api/generate-test/route.ts).
 */
function buildFallbackTest(subject: string): GeneratedTest {
  return {
    title: `Verify: ${subject}`.slice(0, 40),
    intro: `A qualification test for reviewing "${subject}" guides. Answer thoroughly — this decides whether you can approve others' work.`,
    questions: [
      { id: 1, type: 'short_answer', category: 'SUBJECT MASTERY', question: `Explain the single most commonly misunderstood idea in ${subject}, and how you would correct it in a guide.` },
      { id: 2, type: 'short_answer', category: 'ERROR DETECTION', question: `Describe a factual error you have seen (or could imagine) in beginner material on ${subject}, and how you'd catch it as a verifier.` },
      { id: 3, type: 'multiple_choice', category: 'REVIEW JUDGEMENT', question: 'A submitted guide is accurate but assumes prerequisites it never lists. As a verifier you should:', options: [
        'Reject citing prerequisite gap and name the missing prereqs',
        'Approve — accuracy is all that matters',
        'Rewrite the guide yourself',
        'Ignore it; users will figure it out',
      ] },
      { id: 4, type: 'short_answer', category: 'PREREQUISITE SOUNDNESS', question: `What must a learner already understand before a ${subject} guide at this level makes sense? Justify each prerequisite.` },
      { id: 5, type: 'scale', category: 'CONFIDENCE', question: `How often can you distinguish a subtle conceptual error in ${subject} from a mere stylistic choice?` },
      { id: 6, type: 'short_answer', category: 'SCOPE', question: `Give an example of scope creep you would flag in a ${subject} guide, and explain why it belongs elsewhere.` },
      { id: 7, type: 'multiple_choice', category: 'REVIEW JUDGEMENT', question: 'Two guides cover nearly the same topic. The right verifier action is to:', options: [
        'Flag duplication and recommend a canonical guide',
        'Approve both',
        'Reject both',
        'Merge them without telling the authors',
      ] },
      { id: 8, type: 'short_answer', category: 'SUBJECT MASTERY', question: `Teach the core of ${subject} at this level in your own words, as if writing the opening of the definitive guide.` },
    ],
  };
}

async function generateVerifierTest(subject: string, level: number, difficulty: number): Promise<{
  test: GeneratedTest;
  source: string;
}> {
  const userPrompt = buildUserPrompt(subject, level, difficulty);
  try {
    const raw = await callOpenRouter(userPrompt);
    const parsed = tryParseJson(raw);
    if (isValidGeneratedTest(parsed)) {
      return { test: parsed, source: 'openrouter' };
    }
    console.error('verifier-test: AI response failed validation, using fallback');
  } catch (error) {
    console.error('verifier-test: AI generation failed, using fallback', error);
  }
  return { test: buildFallbackTest(subject), source: 'fallback' };
}

// ── requestVerifierTest ──────────────────────────────────────────────────────

/**
 * Create a verifier-qualification test for a user, subject and level. Persists a
 * `generated_tests` row using the same INSERT shape as
 * app/api/generate-test/route.ts (id, user_id, difficulty, persona, title,
 * shard_reward, source, questions) plus the Phase-7 tags (purpose, metadata).
 * Verifier tests carry no diamond reward — the reward IS the credential — so
 * shard_reward is 0.
 */
export async function requestVerifierTest(
  userId: string,
  subjectInput: unknown,
  levelInput: unknown,
): Promise<VerifierTestRequest> {
  const subject = normalizeSubject(subjectInput);
  const level = normalizeLevel(levelInput);
  const difficulty = difficultyForLevel(level);

  await ensureGeneratedTestsSchema();

  const { test, source } = await generateVerifierTest(subject, level, difficulty);
  const testId = crypto.randomUUID();

  await sqlQuery(
    `INSERT INTO generated_tests
       (id, user_id, difficulty, persona, title, shard_reward, source, questions, purpose, metadata)
     VALUES
       (:id, :userId, :difficulty, :persona, :title, :shardReward, :source, :questions::jsonb, :purpose, :metadata::jsonb)`,
    {
      id: testId,
      userId,
      difficulty,
      persona: `Verifier: ${subject}`.slice(0, 60),
      title: test.title.slice(0, 80),
      shardReward: 0,
      source,
      questions: JSON.stringify(test.questions),
      purpose: VERIFIER_TEST_PURPOSE,
      metadata: JSON.stringify({ subject, level }),
    },
  );

  return {
    testId,
    subject,
    level,
    difficulty,
    title: test.title,
    intro: test.intro,
    questions: test.questions,
  };
}

// ── Grading ──────────────────────────────────────────────────────────────────

interface StoredQuestion {
  id: number;
  type: 'multiple_choice' | 'short_answer' | 'scale';
}

/**
 * Score a set of answers against the stored questions.
 *
 * Generated tests carry no answer key (like the survey flow), so scoring is
 * completeness-and-effort based, mirroring how app/api/generate-test/complete
 * validates a submission: every question must be answered, and each short_answer
 * must clear MIN_SHORT_ANSWER_CHARS. Score = fraction of questions that meet
 * their bar, as a 0–100 integer. A blank or too-short short-answer earns no
 * credit for that question, so a candidate who skips the written work cannot
 * reach the 80% pass mark.
 */
export function scoreAnswers(questions: StoredQuestion[], answers: AnswersMap): number {
  if (!Array.isArray(questions) || questions.length === 0) return 0;
  let credited = 0;
  for (const q of questions) {
    const answer = answers?.[q.id] ?? answers?.[String(q.id)];
    if (q.type === 'short_answer') {
      if (typeof answer === 'string' && answer.trim().length >= MIN_SHORT_ANSWER_CHARS) credited += 1;
    } else if (q.type === 'scale') {
      const n = Number(answer);
      if (Number.isFinite(n) && n >= 1 && n <= 5) credited += 1;
    } else {
      // multiple_choice: any non-empty selection counts as answered.
      if (typeof answer === 'string' ? answer.trim().length > 0 : Number.isFinite(Number(answer))) {
        credited += 1;
      }
    }
  }
  return Math.round((credited / questions.length) * 100);
}

// ── gradeVerifierTest ────────────────────────────────────────────────────────

/**
 * Grade a submitted verifier test and, on a pass, upsert the credential.
 *
 * All-or-nothing transaction:
 *   1. Load the verifier test row (must exist, be tagged, belong to userId, and
 *      not already be graded).
 *   2. Score the answers; mark the test complete (completed_at + answers).
 *   3. On pass (score >= PASS_THRESHOLD): upsert verifier_credentials —
 *      max_level = the requested level only if it is HIGHER than the user's
 *      current max_level for that subject (a pass never demotes an existing,
 *      higher credential). earned_via = 'tiered_test'.
 *
 * Passing the SAME level again is idempotent (max_level unchanged).
 */
export async function gradeVerifierTest(
  testId: string,
  userId: string,
  answers: AnswersMap,
): Promise<GradeResult> {
  return withTransaction(async (client) => {
    const rows = await sqlQueryWithClient<Array<{
      id: string;
      user_id: string | null;
      purpose: string | null;
      metadata: { subject?: string; level?: number } | null;
      questions: StoredQuestion[] | null;
      completed_at: string | null;
    }>>(
      client,
      `SELECT id, user_id, purpose, metadata, questions, completed_at
       FROM generated_tests
       WHERE id = :testId
       FOR UPDATE`,
      { testId },
    );
    const row = rows[0];
    if (!row) throw httpError('Verifier test not found.', 404);
    if (row.user_id !== userId) {
      throw httpError('This verifier test does not belong to you.', 403);
    }
    if (row.purpose !== VERIFIER_TEST_PURPOSE) {
      throw httpError('That test is not a verifier qualification test.', 400);
    }
    if (row.completed_at) {
      throw httpError('This verifier test has already been submitted.', 409);
    }

    const subject = typeof row.metadata?.subject === 'string' ? row.metadata.subject : '';
    const level = normalizeLevel(row.metadata?.level ?? 0);
    if (!subject) {
      throw httpError('Verifier test is missing its subject metadata.', 500);
    }

    const questions = Array.isArray(row.questions) ? row.questions : [];
    const score = scoreAnswers(questions, answers);
    const passed = score >= PASS_THRESHOLD;

    await sqlQueryWithClient(
      client,
      `UPDATE generated_tests
       SET completed_at = CURRENT_TIMESTAMP,
           answers = :answers::jsonb
       WHERE id = :testId AND completed_at IS NULL`,
      { testId, answers: JSON.stringify(answers) },
    );

    let credential: VerifierCredential | null = null;
    if (passed) {
      // Upsert: raise max_level to the tested level only if higher. GREATEST keeps
      // any existing higher credential intact (a pass never demotes).
      const credRows = await sqlQueryWithClient<Array<{
        subject: string;
        max_level: number;
        earned_via: string;
        created_at: string;
        updated_at: string;
      }>>(
        client,
        `INSERT INTO verifier_credentials (user_id, subject, max_level, earned_via)
         VALUES (:userId, :subject, :level, 'tiered_test')
         ON CONFLICT (user_id, subject) DO UPDATE SET
           max_level = GREATEST(verifier_credentials.max_level, EXCLUDED.max_level),
           earned_via = 'tiered_test',
           updated_at = CURRENT_TIMESTAMP
         RETURNING subject, max_level, earned_via, created_at, updated_at`,
        { userId, subject, level },
      );
      const c = credRows[0];
      credential = {
        subject: c.subject,
        maxLevel: c.max_level,
        earnedVia: c.earned_via,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      };
    }

    return {
      testId,
      subject,
      level,
      score,
      passed,
      passThreshold: PASS_THRESHOLD,
      credential,
    };
  });
}

// ── getCredentials ───────────────────────────────────────────────────────────

/** All verifier credentials held by a user, highest level first. */
export async function getCredentials(userId: string): Promise<VerifierCredential[]> {
  const rows = await sqlQuery<Array<{
    subject: string;
    max_level: number;
    earned_via: string;
    created_at: string;
    updated_at: string;
  }>>(
    `SELECT subject, max_level, earned_via, created_at, updated_at
     FROM verifier_credentials
     WHERE user_id = :userId
     ORDER BY max_level DESC, subject ASC`,
    { userId },
  );
  return rows.map((r) => ({
    subject: r.subject,
    maxLevel: r.max_level,
    earnedVia: r.earned_via,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
