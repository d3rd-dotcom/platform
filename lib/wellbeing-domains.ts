/**
 * Wellbeing-domain labels for guide subjects, styled after the constructs in
 * the Warwick-Edinburgh Mental Well-being Scale (WEMWBS) — a validated
 * positive-mental-health measure MWA already tracks as a KPI (see
 * lib/blue-knowledge.ts, "kpi-metrics"). This file does NOT score anyone
 * against WEMWBS; it is a static, editorial mapping from a guide subject tag
 * to a short "which part of feeling well this supports" label.
 *
 * HARD GUARDRAIL: no clinical claims. A domain label is never a diagnosis, a
 * treatment, or an outcome promise — copy stays in "supports/strengthens"
 * territory and stays short (EDITORIAL.md voice: upbeat, academic, short,
 * sentence case, no emojis, no all-caps, never "X not Y").
 *
 * Subjects are freeform tags (guide_subjects, see lib/guides-db.ts) — authors
 * can type anything. This map only covers subjects we can label with
 * confidence; anything else falls back to no domain label, which is the
 * correct behavior, not a bug.
 */

export interface WellbeingDomain {
  /** Stable id, also usable as a CSS/data hook. */
  id: string;
  /** Short label for the domain itself, e.g. "Feeling close to people". */
  label: string;
  /** One short sentence, "supports/strengthens" register, no clinical claims. */
  blurb: string;
}

const DOMAINS = {
  optimism: {
    id: 'optimism',
    label: 'Optimism',
    blurb: 'Supports feeling optimistic about what is ahead.',
  },
  feelingUseful: {
    id: 'feeling-useful',
    label: 'Feeling useful',
    blurb: 'Supports feeling useful.',
  },
  feelingRelaxed: {
    id: 'feeling-relaxed',
    label: 'Feeling relaxed',
    blurb: 'Supports feeling relaxed.',
  },
  energy: {
    id: 'energy',
    label: 'Energy to spare',
    blurb: 'Supports having energy to spare.',
  },
  dealingWithProblems: {
    id: 'dealing-with-problems',
    label: 'Dealing with problems well',
    blurb: 'Strengthens dealing with problems well.',
  },
  thinkingClearly: {
    id: 'thinking-clearly',
    label: 'Thinking clearly',
    blurb: 'Strengthens thinking clearly.',
  },
  selfAcceptance: {
    id: 'self-acceptance',
    label: 'Feeling good about yourself',
    blurb: 'Supports feeling good about yourself.',
  },
  feelingClose: {
    id: 'feeling-close',
    label: 'Feeling close to people',
    blurb: 'Supports feeling close to other people.',
  },
  confidence: {
    id: 'confidence',
    label: 'Confidence',
    blurb: 'Supports feeling confident.',
  },
  independentMind: {
    id: 'independent-mind',
    label: 'Making up your own mind',
    blurb: 'Supports making up your own mind about things.',
  },
  curiosity: {
    id: 'curiosity',
    label: 'Interest in new things',
    blurb: 'Supports interest in new things.',
  },
  cheerfulness: {
    id: 'cheerfulness',
    label: 'Cheerfulness',
    blurb: 'Supports feeling cheerful.',
  },
} as const satisfies Record<string, WellbeingDomain>;

/**
 * Subject tag (lowercased, trimmed) → domain. Keys cover the seeded starter
 * subjects (db/seed-guides.sql: Foundations, Focus, Emotional Regulation,
 * Reflection, Habits) plus common subject tags likely to show up as the
 * guide library grows. Unmapped subjects intentionally resolve to `null`.
 */
const SUBJECT_TO_DOMAIN: Record<string, WellbeingDomain> = {
  // Seeded starter subjects
  foundations: DOMAINS.thinkingClearly,
  focus: DOMAINS.thinkingClearly,
  'emotional regulation': DOMAINS.dealingWithProblems,
  reflection: DOMAINS.independentMind,
  habits: DOMAINS.energy,

  // Common extensions
  mindfulness: DOMAINS.feelingRelaxed,
  meditation: DOMAINS.feelingRelaxed,
  sleep: DOMAINS.feelingRelaxed,
  communication: DOMAINS.feelingClose,
  relationships: DOMAINS.feelingClose,
  community: DOMAINS.feelingClose,
  'self-compassion': DOMAINS.selfAcceptance,
  'self compassion': DOMAINS.selfAcceptance,
  'self-esteem': DOMAINS.selfAcceptance,
  confidence: DOMAINS.confidence,
  boundaries: DOMAINS.confidence,
  resilience: DOMAINS.dealingWithProblems,
  'problem-solving': DOMAINS.dealingWithProblems,
  'problem solving': DOMAINS.dealingWithProblems,
  gratitude: DOMAINS.optimism,
  purpose: DOMAINS.feelingUseful,
  'goal-setting': DOMAINS.feelingUseful,
  'goal setting': DOMAINS.feelingUseful,
  productivity: DOMAINS.feelingUseful,
  creativity: DOMAINS.curiosity,
  'critical thinking': DOMAINS.thinkingClearly,
  'media literacy': DOMAINS.thinkingClearly,
  'decision-making': DOMAINS.independentMind,
  'decision making': DOMAINS.independentMind,
  values: DOMAINS.independentMind,
  'financial literacy': DOMAINS.feelingUseful,
  'physical health': DOMAINS.energy,
  movement: DOMAINS.energy,
  nutrition: DOMAINS.energy,
  'mindfulness and meditation': DOMAINS.feelingRelaxed,
  'wellness science': DOMAINS.energy,
  'research and statistics': DOMAINS.thinkingClearly,
  'social psychology': DOMAINS.feelingClose,
  'learning science': DOMAINS.thinkingClearly,
  neuroscience: DOMAINS.thinkingClearly,
  'public health': DOMAINS.feelingUseful,
  'lifespan development': DOMAINS.curiosity,
  'ethics and society': DOMAINS.independentMind,
  cheerfulness: DOMAINS.cheerfulness,
  humor: DOMAINS.cheerfulness,
};

/** Case/whitespace-insensitive lookup. Returns null for unmapped subjects. */
export function getWellbeingDomain(subject: string): WellbeingDomain | null {
  const key = subject.trim().toLowerCase();
  return SUBJECT_TO_DOMAIN[key] ?? null;
}
