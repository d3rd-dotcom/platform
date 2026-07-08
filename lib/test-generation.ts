/**
 * Shared helpers for AI-generated tests (surveys and verifier-qualification
 * tests). Both app/api/generate-test/ and lib/verifier-tests-db.ts parse and
 * validate model output through here so a malformed or low-quality generation is
 * rejected BEFORE it is persisted — we never store junk the model emitted.
 *
 * Two shapes share one validator:
 *   - Survey items are self-report (no answer key). MC options are distinct
 *     stances; there is no "correct" one.
 *   - Verifier items are a knowledge assessment (requireAnswerKey = true): every
 *     multiple_choice item carries a 0-based `answer` index and a one-line
 *     `explanation` of why that option is right.
 */

/** Minimum trimmed length for a question stem — rejects one-word / empty stems. */
export const MIN_STEM_LENGTH = 15;

/** Options a multiple_choice item must have (exactly). */
export const MC_OPTION_COUNT = 4;

export type QuestionType = 'multiple_choice' | 'short_answer' | 'scale';

export interface GeneratedQuestion {
  id: number;
  type: QuestionType;
  category: string;
  question: string;
  options?: string[];
  /** 0-based index of the correct option (answer-key tests only). */
  answer?: number;
  /** One line: why the correct option is right (answer-key tests only). */
  explanation?: string;
}

export interface GeneratedTestShape {
  title: string;
  intro: string;
  questions: GeneratedQuestion[];
}

export interface ValidateTestOptions {
  /** Exact number of questions the schema requires. */
  questionCount: number;
  /** When true, every multiple_choice item must carry a valid answer + explanation. */
  requireAnswerKey: boolean;
}

export type ValidateTestResult =
  | { ok: true; data: GeneratedTestShape }
  | { ok: false; reason: string };

const QUESTION_TYPES: QuestionType[] = ['multiple_choice', 'short_answer', 'scale'];
const BANNED_OPTION_RE = /^(all|none|both|any)\s+of\s+the\s+(above|below|options)/i;

/**
 * Tolerant JSON extraction: strips markdown fences, then falls back to the first
 * balanced-looking {...} slice. Returns null when nothing parses.
 */
export function parseTestJson(raw: string): unknown | null {
  const stripped = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');

  try {
    return JSON.parse(stripped);
  } catch {
    const first = stripped.indexOf('{');
    const last = stripped.lastIndexOf('}');
    if (first >= 0 && last > first) {
      try {
        return JSON.parse(stripped.slice(first, last + 1));
      } catch {
        /* fall through */
      }
    }
    return null;
  }
}

function validateOptions(
  opts: unknown,
  requireAnswerKey: boolean,
  answer: unknown,
  explanation: unknown,
  where: string,
): { ok: true; options: string[]; answer?: number; explanation?: string } | { ok: false; reason: string } {
  if (!Array.isArray(opts) || opts.length !== MC_OPTION_COUNT) {
    return { ok: false, reason: `${where}: expected exactly ${MC_OPTION_COUNT} options` };
  }
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const opt of opts) {
    if (typeof opt !== 'string') return { ok: false, reason: `${where}: non-string option` };
    const trimmed = opt.trim();
    if (!trimmed) return { ok: false, reason: `${where}: empty option` };
    if (BANNED_OPTION_RE.test(trimmed)) {
      return { ok: false, reason: `${where}: banned option ("all of the above" style)` };
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `${where}: duplicate option` };
    seen.add(key);
    cleaned.push(trimmed);
  }

  if (!requireAnswerKey) {
    return { ok: true, options: cleaned };
  }

  const idx = typeof answer === 'number' ? answer : Number(answer);
  if (!Number.isInteger(idx) || idx < 0 || idx >= cleaned.length) {
    return { ok: false, reason: `${where}: answer index out of range` };
  }
  if (typeof explanation !== 'string' || explanation.trim().length < 10) {
    return { ok: false, reason: `${where}: missing or too-short explanation` };
  }
  return { ok: true, options: cleaned, answer: idx, explanation: explanation.trim() };
}

/**
 * Validate and normalise a parsed test object. Fail-closed: any structural
 * problem returns { ok: false, reason } and the caller must NOT persist it.
 * On success returns trimmed, schema-clean data ready to store.
 */
export function validateGeneratedTest(value: unknown, opts: ValidateTestOptions): ValidateTestResult {
  if (!value || typeof value !== 'object') return { ok: false, reason: 'not an object' };
  const data = value as Partial<GeneratedTestShape>;

  if (typeof data.title !== 'string' || !data.title.trim()) return { ok: false, reason: 'missing title' };
  if (typeof data.intro !== 'string' || !data.intro.trim()) return { ok: false, reason: 'missing intro' };
  if (!Array.isArray(data.questions)) return { ok: false, reason: 'questions is not an array' };
  if (data.questions.length !== opts.questionCount) {
    return { ok: false, reason: `expected ${opts.questionCount} questions, got ${data.questions.length}` };
  }

  const normalised: GeneratedQuestion[] = [];
  for (let i = 0; i < data.questions.length; i += 1) {
    const raw = data.questions[i] as Partial<GeneratedQuestion> | undefined;
    const where = `question ${i + 1}`;
    if (!raw || typeof raw !== 'object') return { ok: false, reason: `${where}: not an object` };
    if (raw.id !== i + 1) return { ok: false, reason: `${where}: id must be ${i + 1}` };
    if (!QUESTION_TYPES.includes(raw.type as QuestionType)) {
      return { ok: false, reason: `${where}: invalid type` };
    }
    if (typeof raw.category !== 'string' || !raw.category.trim()) {
      return { ok: false, reason: `${where}: missing category` };
    }
    if (typeof raw.question !== 'string' || raw.question.trim().length < MIN_STEM_LENGTH) {
      return { ok: false, reason: `${where}: stem under ${MIN_STEM_LENGTH} chars` };
    }

    const base: GeneratedQuestion = {
      id: i + 1,
      type: raw.type as QuestionType,
      category: raw.category.trim(),
      question: raw.question.trim(),
    };

    if (raw.type === 'multiple_choice') {
      const res = validateOptions(raw.options, opts.requireAnswerKey, raw.answer, raw.explanation, where);
      if (!res.ok) return res;
      base.options = res.options;
      if (opts.requireAnswerKey) {
        base.answer = res.answer;
        base.explanation = res.explanation;
      }
    } else if (raw.options !== undefined && (!Array.isArray(raw.options) || raw.options.length > 0)) {
      return { ok: false, reason: `${where}: ${raw.type} must not carry options` };
    }

    normalised.push(base);
  }

  return {
    ok: true,
    data: { title: data.title.trim(), intro: data.intro.trim(), questions: normalised },
  };
}

/**
 * Strip the answer key from questions before returning them to the client at
 * request time — the candidate must never see which option is correct until they
 * have submitted.
 */
export function stripAnswerKey(questions: GeneratedQuestion[]): GeneratedQuestion[] {
  return questions.map(({ answer: _answer, explanation: _explanation, ...rest }) => rest);
}
