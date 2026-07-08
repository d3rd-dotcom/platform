import { describe, it, expect } from 'vitest';
import { parseTestJson, validateGeneratedTest, stripAnswerKey } from '@/lib/test-generation';
import { scoreAnswers } from '@/lib/verifier-tests-db';

// ─────────────────────────────────────────────────────────────────────────────
// Generation validation + answer-key grading. These observe shipping behaviour
// of the shared validator (lib/test-generation) and the answer-key-aware branch
// of scoreAnswers (lib/verifier-tests-db).
// ─────────────────────────────────────────────────────────────────────────────

function mcItem(id: number, answer: number, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'multiple_choice',
    category: 'REVIEW JUDGEMENT',
    question: `A realistic scenario stem number ${id} that is comfortably long enough.`,
    options: ['Option one text', 'Option two text', 'Option three text', 'Option four text'],
    answer,
    explanation: 'Because the first-best option follows directly from the material.',
    ...extra,
  };
}

function verifierTest(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Verify: Stoicism',
    intro: 'Pass this and you can review guides on Stoicism.',
    questions: [
      mcItem(1, 0),
      mcItem(2, 1),
      mcItem(3, 2),
      mcItem(4, 3),
      mcItem(5, 0),
      mcItem(6, 1),
      { id: 7, type: 'short_answer', category: 'SUBJECT MASTERY', question: 'Explain the most misunderstood idea and how to correct it.' },
      { id: 8, type: 'short_answer', category: 'ERROR DETECTION', question: 'Describe a plausible beginner error and how you would catch it.' },
    ],
    ...overrides,
  };
}

describe('parseTestJson', () => {
  it('parses plain JSON', () => {
    expect(parseTestJson('{"a":1}')).toEqual({ a: 1 });
  });
  it('strips markdown fences', () => {
    expect(parseTestJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('extracts the first balanced object from noise', () => {
    expect(parseTestJson('here you go: {"a":1} thanks')).toEqual({ a: 1 });
  });
  it('returns null for unparseable input', () => {
    expect(parseTestJson('not json at all')).toBeNull();
  });
});

describe('validateGeneratedTest — verifier (answer key required)', () => {
  const opts = { questionCount: 8, requireAnswerKey: true } as const;

  it('accepts a well-formed answer-keyed test and normalises it', () => {
    const res = validateGeneratedTest(verifierTest(), opts);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.questions).toHaveLength(8);
      expect(res.data.questions[0].answer).toBe(0);
      expect(res.data.questions[0].explanation).toBeTruthy();
    }
  });

  it('rejects an out-of-range answer index', () => {
    const bad = verifierTest();
    (bad.questions[0] as any).answer = 9;
    const res = validateGeneratedTest(bad, opts);
    expect(res.ok).toBe(false);
  });

  it('rejects duplicate options', () => {
    const bad = verifierTest();
    (bad.questions[0] as any).options = ['same', 'same', 'c', 'd'];
    expect(validateGeneratedTest(bad, opts).ok).toBe(false);
  });

  it('rejects "all of the above" style options', () => {
    const bad = verifierTest();
    (bad.questions[0] as any).options = ['a', 'b', 'c', 'All of the above'];
    expect(validateGeneratedTest(bad, opts).ok).toBe(false);
  });

  it('rejects a missing explanation', () => {
    const bad = verifierTest();
    delete (bad.questions[0] as any).explanation;
    expect(validateGeneratedTest(bad, opts).ok).toBe(false);
  });

  it('rejects a too-short stem', () => {
    const bad = verifierTest();
    (bad.questions[0] as any).question = 'too short';
    expect(validateGeneratedTest(bad, opts).ok).toBe(false);
  });

  it('rejects the wrong question count', () => {
    const bad = verifierTest();
    bad.questions = bad.questions.slice(0, 7);
    expect(validateGeneratedTest(bad, opts).ok).toBe(false);
  });
});

describe('validateGeneratedTest — survey (no answer key)', () => {
  const opts = { questionCount: 8, requireAnswerKey: false } as const;

  it('accepts self-report MC without an answer and strips any stray key', () => {
    const survey = verifierTest();
    const res = validateGeneratedTest(survey, opts);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // No answer/explanation retained when the key is not required.
      expect(res.data.questions[0].answer).toBeUndefined();
      expect(res.data.questions[0].explanation).toBeUndefined();
    }
  });
});

describe('stripAnswerKey', () => {
  it('removes answer and explanation but keeps options', () => {
    const [q] = stripAnswerKey([
      { id: 1, type: 'multiple_choice', category: 'C', question: 'q', options: ['a', 'b', 'c', 'd'], answer: 2, explanation: 'why' },
    ]);
    expect(q.options).toHaveLength(4);
    expect((q as any).answer).toBeUndefined();
    expect((q as any).explanation).toBeUndefined();
  });
});

describe('scoreAnswers — answer-key-aware MC grading', () => {
  const keyed = [
    { id: 1, type: 'multiple_choice' as const, options: ['A text', 'B text', 'C text', 'D text'], answer: 1 },
    { id: 2, type: 'multiple_choice' as const, options: ['A text', 'B text', 'C text', 'D text'], answer: 3 },
  ];

  it('credits a correct selection by option text', () => {
    expect(scoreAnswers(keyed, { 1: 'B text', 2: 'D text' })).toBe(100);
  });

  it('does not credit a wrong selection', () => {
    expect(scoreAnswers(keyed, { 1: 'A text', 2: 'D text' })).toBe(50);
  });

  it('credits a correct selection by 0-based index too', () => {
    expect(scoreAnswers(keyed, { 1: 1, 2: 3 })).toBe(100);
  });

  it('legacy MC without a key still credits any selection', () => {
    const legacy = [{ id: 1, type: 'multiple_choice' as const }];
    expect(scoreAnswers(legacy, { 1: 'anything' })).toBe(100);
  });
});
