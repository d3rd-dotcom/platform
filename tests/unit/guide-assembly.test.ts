import { describe, it, expect } from 'vitest';
import { decomposeGuideBody } from '@/lib/guide-assembly';
import type { GuideBodyComponent } from '@/lib/guides-db';

// ─────────────────────────────────────────────────────────────────────────────
// Pure decomposition logic for the Assemble game. decomposeGuideBody is a real
// export from lib/guide-assembly.ts; nothing here is re-implemented, so these
// tests observe the shipping behaviour: deterministic sentence→axiom splitting,
// stable contentVersion hashing, and the guardrails (min length, dedupe, caps).
// No database, no network — the module is side-effect free.
// ─────────────────────────────────────────────────────────────────────────────

function comp(title: string | undefined, content: string): GuideBodyComponent {
  return {
    id: Math.random().toString(36).slice(2),
    componentType: 'rich_text',
    title,
    config: { content },
  };
}

describe('decomposeGuideBody — sentence splitting', () => {
  it('splits a paragraph into one axiom per sentence', () => {
    const draft = decomposeGuideBody(
      [comp('Basics', 'Anxiety is a normal response to stress. It becomes a problem when it persists. Naming the feeling reduces its grip on you.')],
      'Understanding Anxiety',
    );
    expect(draft.sections).toHaveLength(1);
    expect(draft.sections[0].axioms).toHaveLength(3);
    expect(draft.axiomCount).toBe(3);
    expect(draft.sections[0].axioms[0].statement).toBe('Anxiety is a normal response to stress.');
  });

  it('does not split on abbreviations or decimals', () => {
    const draft = decomposeGuideBody(
      [comp('Study', 'The study followed 3.5 million people, e.g. across many nations. That scale matters for the conclusion.')],
      'Meta Analysis',
    );
    expect(draft.sections[0].axioms).toHaveLength(2);
    expect(draft.sections[0].axioms[0].statement).toContain('3.5 million');
    expect(draft.sections[0].axioms[0].statement).toContain('e.g.');
  });

  it('drops fragments below the minimum length or word count', () => {
    const draft = decomposeGuideBody(
      [comp('Notes', 'Yes. A properly formed claim needs enough substance to judge on its own.')],
      'Notes',
    );
    // "Yes." is too short — only the real claim survives.
    expect(draft.sections[0].axioms).toHaveLength(1);
    expect(draft.sections[0].axioms[0].statement).toContain('properly formed claim');
  });
});

describe('decomposeGuideBody — structure and hashing', () => {
  it('is deterministic: identical bodies produce identical contentVersion + hashes', () => {
    const body = [comp('A', 'This is the very first claim to consider. And here is a second one to weigh.')];
    const a = decomposeGuideBody(body, 'Topic');
    const b = decomposeGuideBody(body, 'Topic');
    expect(a.contentVersion).toBe(b.contentVersion);
    expect(a.sections[0].axioms.map((x) => x.hash)).toEqual(
      b.sections[0].axioms.map((x) => x.hash),
    );
  });

  it('changes contentVersion when the prose changes', () => {
    const a = decomposeGuideBody([comp('A', 'The mind resists what it will not name clearly.')], 'Topic');
    const b = decomposeGuideBody([comp('A', 'The mind resists what it refuses to name clearly.')], 'Topic');
    expect(a.contentVersion).not.toBe(b.contentVersion);
  });

  it('nulls a section label that echoes the guide title', () => {
    const draft = decomposeGuideBody(
      [comp('Shadow Work', 'Shadow work means meeting the parts of yourself you would rather disown.')],
      'Shadow Work',
    );
    expect(draft.sections[0].label).toBeNull();
  });

  it('keeps a distinct section label', () => {
    const draft = decomposeGuideBody(
      [comp('Getting started', 'Begin by writing down one honest sentence about your day.')],
      'Journaling',
    );
    expect(draft.sections[0].label).toBe('Getting started');
  });

  it('strips markdown before splitting', () => {
    const draft = decomposeGuideBody(
      [comp('Intro', '# Heading\n\nThis is **bold** and a [link](https://x.com) inside a real sentence.')],
      'Markdown',
    );
    const statement = draft.sections[0].axioms[0].statement;
    expect(statement).not.toContain('**');
    expect(statement).not.toContain('](');
    expect(statement).toContain('bold');
    expect(statement).toContain('link');
  });

  it('dedupes identical claims within a section', () => {
    const draft = decomposeGuideBody(
      [comp('Repeat', 'Consistency beats intensity over time. Consistency beats intensity over time.')],
      'Habits',
    );
    expect(draft.sections[0].axioms).toHaveLength(1);
  });

  it('yields zero sections for a body with no real prose', () => {
    const draft = decomposeGuideBody([comp('Empty', '   \n\n   ')], 'Nothing');
    expect(draft.sections).toHaveLength(0);
    expect(draft.axiomCount).toBe(0);
  });
});
