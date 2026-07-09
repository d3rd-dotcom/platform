import { describe, expect, it } from 'vitest';
import { createGuideBodySchema } from '@/lib/guide-api-schemas';

describe('canonical guide metadata schema', () => {
  it('accepts the complete contributor metadata shape', () => {
    const parsed = createGuideBodySchema.safeParse({
      topicTitle: 'Attention Basics',
      topicAliases: ['Sustained attention', 'Focus basics'],
      summary: 'Learn how attention selects information and guides deliberate action.',
      intendedAudience: 'Learners building foundational focus skills.',
      estimatedMinutes: 18,
      sourceProvenance: 'Adapted from peer-reviewed cognitive psychology research.',
      sourceReviewedAt: '2026-07-09',
      subjectIds: ['foundations', 'focus'],
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid duration and review dates', () => {
    expect(
      createGuideBodySchema.safeParse({
        topicTitle: 'Attention Basics',
        estimatedMinutes: 0,
      }).success,
    ).toBe(false);
    expect(
      createGuideBodySchema.safeParse({
        topicTitle: 'Attention Basics',
        sourceReviewedAt: 'July 9',
      }).success,
    ).toBe(false);
    expect(
      createGuideBodySchema.safeParse({
        topicTitle: 'Attention Basics',
        sourceReviewedAt: '2026-02-31',
      }).success,
    ).toBe(false);
  });

  it('caps aliases and canonical subjects at twelve entries', () => {
    const thirteen = Array.from({ length: 13 }, (_, index) => `item-${index}`);
    expect(
      createGuideBodySchema.safeParse({
        topicTitle: 'Attention Basics',
        topicAliases: thirteen,
      }).success,
    ).toBe(false);
    expect(
      createGuideBodySchema.safeParse({
        topicTitle: 'Attention Basics',
        subjectIds: thirteen,
      }).success,
    ).toBe(false);
  });
});
