import { describe, it, expect } from 'vitest';
import {
  scoreAnswers,
  normalizeSubject,
  normalizeLevel,
  PASS_THRESHOLD,
  MAX_LEVEL,
} from '@/lib/verifier-tests-db';
import { MIN_SHORT_ANSWER_CHARS } from '@/lib/test-rewards';

// ─────────────────────────────────────────────────────────────────────────────
// Pure guide-system logic. Everything imported here is a real export from lib/;
// nothing is re-implemented, so these tests observe the shipping behaviour.
//
// NOTE on toOdd: the panel-size "force odd" helper (toOdd) in
// lib/guide-verification-db.ts is module-private (not exported), so it cannot be
// imported without editing lib/. Its contract is instead exercised end-to-end by
// the DB-gated panel-draw path. We keep an inline spec of the SAME rule here as
// documentation, and a mirror check, but the authoritative helper stays untouched.
// ─────────────────────────────────────────────────────────────────────────────

// Mirror of lib/guide-verification-db.ts:toOdd — kept verbatim. See note above.
const toOddMirror = (n: number): number => (n % 2 === 0 ? n - 1 : n);

describe('toOdd (panel size — mirrored, see file note)', () => {
  it('leaves odd numbers unchanged', () => {
    expect(toOddMirror(1)).toBe(1);
    expect(toOddMirror(3)).toBe(3);
    expect(toOddMirror(5)).toBe(5);
  });

  it('drops one from even numbers (n -> n-1)', () => {
    expect(toOddMirror(2)).toBe(1);
    expect(toOddMirror(4)).toBe(3);
    expect(toOddMirror(6)).toBe(5);
  });

  it('keeps 1 as 1 (smallest valid panel)', () => {
    expect(toOddMirror(1)).toBe(1);
  });
});

describe('scoreAnswers', () => {
  it('returns 0 for empty / non-array question sets', () => {
    expect(scoreAnswers([], {})).toBe(0);
    // @ts-expect-error — exercising the defensive non-array guard
    expect(scoreAnswers(null, {})).toBe(0);
  });

  it('short_answer needs >= MIN_SHORT_ANSWER_CHARS (100) non-whitespace chars', () => {
    const q = [{ id: 1, type: 'short_answer' as const }];
    // Exactly 99 chars — below the bar.
    expect(scoreAnswers(q, { 1: 'a'.repeat(MIN_SHORT_ANSWER_CHARS - 1) })).toBe(0);
    // Exactly 100 chars — meets the bar.
    expect(scoreAnswers(q, { 1: 'a'.repeat(MIN_SHORT_ANSWER_CHARS) })).toBe(100);
    // 101 chars — over the bar.
    expect(scoreAnswers(q, { 1: 'a'.repeat(MIN_SHORT_ANSWER_CHARS + 1) })).toBe(100);
  });

  it('short_answer trims before measuring (padding does not count)', () => {
    const q = [{ id: 1, type: 'short_answer' as const }];
    const padded = '   ' + 'x'.repeat(MIN_SHORT_ANSWER_CHARS - 1) + '   ';
    expect(scoreAnswers(q, { 1: padded })).toBe(0);
    const ok = '   ' + 'x'.repeat(MIN_SHORT_ANSWER_CHARS) + '   ';
    expect(scoreAnswers(q, { 1: ok })).toBe(100);
  });

  it('scale credits only 1..5 inclusive', () => {
    const q = [{ id: 1, type: 'scale' as const }];
    expect(scoreAnswers(q, { 1: 0 })).toBe(0);
    expect(scoreAnswers(q, { 1: 1 })).toBe(100);
    expect(scoreAnswers(q, { 1: 5 })).toBe(100);
    expect(scoreAnswers(q, { 1: 6 })).toBe(0);
    expect(scoreAnswers(q, { 1: 'not a number' })).toBe(0);
    // String numerals are coerced.
    expect(scoreAnswers(q, { 1: '3' })).toBe(100);
  });

  it('multiple_choice credits any non-empty selection', () => {
    const q = [{ id: 1, type: 'multiple_choice' as const }];
    expect(scoreAnswers(q, { 1: '' })).toBe(0);
    expect(scoreAnswers(q, { 1: '   ' })).toBe(0);
    expect(scoreAnswers(q, { 1: 'B' })).toBe(100);
    expect(scoreAnswers(q, { 1: 2 })).toBe(100);
  });

  it('resolves answers by numeric OR string question id', () => {
    const q = [{ id: 7, type: 'multiple_choice' as const }];
    expect(scoreAnswers(q, { '7': 'A' })).toBe(100);
    expect(scoreAnswers(q, { 7: 'A' })).toBe(100);
  });

  it('rounds the fraction to a 0..100 integer', () => {
    // 2 of 3 credited -> round(66.66..) = 67
    const q = [
      { id: 1, type: 'multiple_choice' as const },
      { id: 2, type: 'multiple_choice' as const },
      { id: 3, type: 'multiple_choice' as const },
    ];
    expect(scoreAnswers(q, { 1: 'A', 2: 'B' })).toBe(67);
    // 1 of 3 -> round(33.33..) = 33
    expect(scoreAnswers(q, { 1: 'A' })).toBe(33);
  });

  it('a candidate who skips the written work cannot reach the pass mark', () => {
    // 8-question verifier shape: 5 short_answer, 2 mc, 1 scale.
    const q = [
      { id: 1, type: 'short_answer' as const },
      { id: 2, type: 'short_answer' as const },
      { id: 3, type: 'short_answer' as const },
      { id: 4, type: 'short_answer' as const },
      { id: 5, type: 'short_answer' as const },
      { id: 6, type: 'multiple_choice' as const },
      { id: 7, type: 'multiple_choice' as const },
      { id: 8, type: 'scale' as const },
    ];
    // Answer only the non-written questions: 3 of 8 = 38, below PASS_THRESHOLD.
    const score = scoreAnswers(q, { 6: 'A', 7: 'B', 8: 4 });
    expect(score).toBe(38);
    expect(score).toBeLessThan(PASS_THRESHOLD);
  });

  it('a fully, properly answered verifier test scores 100 (>= PASS_THRESHOLD)', () => {
    const q = [
      { id: 1, type: 'short_answer' as const },
      { id: 2, type: 'multiple_choice' as const },
      { id: 3, type: 'scale' as const },
    ];
    const long = 'y'.repeat(MIN_SHORT_ANSWER_CHARS);
    const score = scoreAnswers(q, { 1: long, 2: 'C', 3: 5 });
    expect(score).toBe(100);
    expect(score).toBeGreaterThanOrEqual(PASS_THRESHOLD);
  });
});

describe('PASS_THRESHOLD constant', () => {
  it('is the documented 80% pass mark', () => {
    expect(PASS_THRESHOLD).toBe(80);
  });
});

describe('normalizeSubject', () => {
  it('trims and collapses internal whitespace', () => {
    expect(normalizeSubject('  Stoic   Ethics  ')).toBe('Stoic Ethics');
  });

  it('rejects subjects shorter than 2 chars', () => {
    expect(() => normalizeSubject('a')).toThrow();
    expect(() => normalizeSubject('   ')).toThrow();
    expect(() => normalizeSubject(42)).toThrow();
  });

  it('caps very long subjects at MAX_SUBJECT_LENGTH (120)', () => {
    const long = 'x'.repeat(500);
    expect(normalizeSubject(long).length).toBe(120);
  });
});

describe('normalizeLevel', () => {
  it('accepts integers 0..MAX_LEVEL', () => {
    expect(normalizeLevel(0)).toBe(0);
    expect(normalizeLevel(MAX_LEVEL)).toBe(MAX_LEVEL);
    // Truncates floats within range.
    expect(normalizeLevel(2.9)).toBe(2);
  });

  it('rejects out-of-range and non-finite levels', () => {
    expect(() => normalizeLevel(-1)).toThrow();
    expect(() => normalizeLevel(MAX_LEVEL + 1)).toThrow();
    expect(() => normalizeLevel('not a number')).toThrow();
  });
});
