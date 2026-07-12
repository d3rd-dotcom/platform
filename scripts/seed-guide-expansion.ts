/**
 * Seeds the next guide collection into the existing knowledge DAG.
 *
 * The content lives in content/guide-drafts/expansion so contributors can edit
 * prose and source trails without digging through the graph wiring. This
 * script keeps the write order explicit: guides, canonical subjects, edges.
 * The database cycle trigger remains authoritative for every edge.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-guide-expansion.ts --dry-run
 *   npx tsx --env-file=.env.local scripts/seed-guide-expansion.ts
 *   npx tsx --env-file=.env.local scripts/seed-guide-expansion.ts --refresh
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isDbConfigured } from '../lib/db';
import {
  addGuidePrereq,
  createGuide,
  getGuideBySlug,
  updateGuide,
} from '../lib/guides-db';

const DRY_RUN = process.argv.includes('--dry-run');
const REFRESH = process.argv.includes('--refresh');
const DRAFTS_DIR = join(__dirname, '..', 'content', 'guide-drafts', 'expansion');
const REVIEW_DATE = '2026-07-09';

interface GuideDef {
  slug: string;
  topicTitle: string;
  topicAliases: string[];
  summary: string;
  intendedAudience: string;
  estimatedMinutes: number;
  sourceProvenance: string;
  subjects: string[];
  subjectIds: string[];
  evidenceCriteria: string[];
  draftPath: string;
  blockTitle: string;
  prereqSlugs: string[];
}

const AUDIENCE = '12+';

const GUIDES: GuideDef[] = [
  {
    slug: 'meditation-foundations',
    topicTitle: 'Meditation Foundations',
    topicAliases: ['Meditation', 'Meditation basics'],
    summary: 'Learn what meditation and mindfulness practice train, how to begin, and how to evaluate evidence carefully.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 12,
    sourceProvenance: 'Original MWA synthesis referencing NCCIH meditation and mindfulness guidance.',
    subjects: ['Mindfulness and Meditation', 'Foundations'],
    subjectIds: ['mindfulness', 'foundations'],
    evidenceCriteria: [
      'The learner can describe an anchor, awareness, and return in a beginner practice.',
      'The learner can complete a short observation practice and record what happened.',
      'The learner can explain why one meditation study needs context before applying to every practice.',
    ],
    draftPath: 'meditation-foundations.md',
    blockTitle: 'Attention, awareness, and a safe beginning',
    prereqSlugs: ['mindful-breathing'],
  },
  {
    slug: 'mindfulness-in-daily-life',
    topicTitle: 'Mindfulness in Daily Life',
    topicAliases: ['Everyday mindfulness', 'Mindful attention'],
    summary: 'Apply present-moment attention to studying, walking, eating, and other repeatable daily activities.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 10,
    sourceProvenance: 'Original MWA synthesis referencing NCCIH and NIMH public health guidance.',
    subjects: ['Mindfulness and Meditation', 'Habits'],
    subjectIds: ['mindfulness', 'habits'],
    evidenceCriteria: [
      'The learner can describe the attention loop used in a daily activity.',
      'The learner can run a small observation experiment without treating it as proof of causation.',
      'The learner can separate noticing a thought from accepting it as true.',
    ],
    draftPath: 'mindfulness-in-daily-life.md',
    blockTitle: 'Attention in ordinary moments',
    prereqSlugs: ['meditation-foundations', 'attention-basics'],
  },
  {
    slug: 'compassion-and-kindness-practice',
    topicTitle: 'Compassion and Kindness Practice',
    topicAliases: ['Self-compassion practice', 'Kindness practice'],
    summary: 'Use clear, respectful language and practical action when responding to difficulty.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 9,
    sourceProvenance: 'Original MWA synthesis referencing NIMH self-care and support guidance.',
    subjects: ['Mindfulness and Meditation', 'Emotional Regulation'],
    subjectIds: ['mindfulness', 'emotional-regulation'],
    evidenceCriteria: [
      'The learner can name the three parts of a compassionate response.',
      'The learner can rewrite self-criticism into a factual and actionable statement.',
      'The learner can identify when boundaries or trusted adult support are needed.',
    ],
    draftPath: 'compassion-and-kindness-practice.md',
    blockTitle: 'Care, clarity, and useful action',
    prereqSlugs: ['meditation-foundations', 'emotional-vocabulary'],
  },
  {
    slug: 'wellness-as-a-system',
    topicTitle: 'Wellness as a System',
    topicAliases: ['Wellness foundations', 'Well-being systems'],
    summary: 'Map how rest, energy, focus, connection, stress, and environment interact across daily life.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 11,
    sourceProvenance: 'Original MWA synthesis referencing NIMH mental health and self-care guidance.',
    subjects: ['Wellness Science', 'Foundations'],
    subjectIds: ['wellness-science', 'foundations'],
    evidenceCriteria: [
      'The learner can name several connected parts of a personal wellness system.',
      'The learner can choose one small, controllable action to test for one week.',
      'The learner can review an observation without turning it into a universal claim.',
    ],
    draftPath: 'wellness-as-a-system.md',
    blockTitle: 'Rest, energy, focus, and connection',
    prereqSlugs: ['mental-health-foundations', 'stress-lifestyle-and-health'],
  },
  {
    slug: 'sleep-and-recovery',
    topicTitle: 'Sleep and Recovery',
    topicAliases: ['Recovery habits', 'Rest and recovery'],
    summary: 'Design a flexible recovery routine and observe how sleep, breaks, and daily cues affect learning capacity.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 10,
    sourceProvenance: 'Original MWA synthesis referencing NIMH mental health guidance and CDC wellness guidance.',
    subjects: ['Wellness Science', 'Habits'],
    subjectIds: ['wellness-science', 'habits'],
    evidenceCriteria: [
      'The learner can distinguish sleep from the wider idea of recovery.',
      'The learner can design one evening cue, morning cue, and daytime reset.',
      'The learner can use a short log to look for patterns without overclaiming.',
    ],
    draftPath: 'sleep-and-recovery.md',
    blockTitle: 'Routines that restore capacity',
    prereqSlugs: ['sleep-basics', 'self-care-techniques'],
  },
  {
    slug: 'movement-and-mood',
    topicTitle: 'Movement and Mood',
    topicAliases: ['Movement for wellness', 'Physical activity and mood'],
    summary: 'Build adaptable movement routines and use simple observations to learn how activity fits your day.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 9,
    sourceProvenance: 'Original MWA synthesis referencing NIMH and CDC physical activity guidance.',
    subjects: ['Wellness Science', 'Habits'],
    subjectIds: ['wellness-science', 'habits'],
    evidenceCriteria: [
      'The learner can turn a movement goal into a specific cue, activity, place, and time.',
      'The learner can track energy and mood while naming other factors that may matter.',
      'The learner can identify when to pause and seek guidance for a physical warning sign.',
    ],
    draftPath: 'movement-and-mood.md',
    blockTitle: 'Adaptable routines and honest observation',
    prereqSlugs: ['building-daily-habits-with-movement', 'motivation-and-emotion'],
  },
  {
    slug: 'science-and-evidence',
    topicTitle: 'Science and Evidence',
    topicAliases: ['Scientific thinking', 'Evidence-based thinking'],
    summary: 'Turn curiosity into researchable questions and match claims to the evidence a method can provide.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 13,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e research methods.',
    subjects: ['Research and Statistics', 'Foundations'],
    subjectIds: ['research-statistics', 'foundations'],
    evidenceCriteria: [
      'The learner can turn a broad curiosity into a question with named variables.',
      'The learner can define sample, population, measure, method, and conclusion.',
      'The learner can identify one limit between a study result and a broad claim.',
    ],
    draftPath: 'science-and-evidence.md',
    blockTitle: 'Questions, methods, and limits',
    prereqSlugs: ['thinking-and-cognition'],
  },
  {
    slug: 'study-design-basics',
    topicTitle: 'Study Design Basics',
    topicAliases: ['Research design', 'Study methods'],
    summary: 'Compare common study methods and design a low-risk, clearly measured project.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 14,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e research methods.',
    subjects: ['Research and Statistics'],
    subjectIds: ['research-statistics'],
    evidenceCriteria: [
      'The learner can match a question with an observational or experimental method.',
      'The learner can identify a comparison, outcome measure, and possible confound.',
      'The learner can name basic consent, privacy, and risk considerations.',
    ],
    draftPath: 'study-design-basics.md',
    blockTitle: 'Methods, comparisons, and ethics',
    prereqSlugs: ['science-and-evidence'],
  },
  {
    slug: 'correlation-and-causation',
    topicTitle: 'Correlation and Causation',
    topicAliases: ['Correlation versus causation', 'Cause and effect'],
    summary: 'Read relationships between variables carefully and match causal language to study design.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 11,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e research methods.',
    subjects: ['Research and Statistics', 'Decision Making'],
    subjectIds: ['research-statistics', 'decision-making'],
    evidenceCriteria: [
      'The learner can describe three possible explanations for a correlation.',
      'The learner can distinguish associated-with language from caused language.',
      'The learner can state why a small personal data table cannot prove a general rule.',
    ],
    draftPath: 'correlation-and-causation.md',
    blockTitle: 'Relationships, explanations, and careful verbs',
    prereqSlugs: ['science-and-evidence'],
  },
  {
    slug: 'descriptive-statistics',
    topicTitle: 'Descriptive Statistics',
    topicAliases: ['Statistics basics', 'Summarizing data'],
    summary: 'Use mean, median, mode, range, and simple charts to describe a set of observations.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 12,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e analysis of findings.',
    subjects: ['Research and Statistics'],
    subjectIds: ['research-statistics'],
    evidenceCriteria: [
      'The learner can calculate mean, median, mode, and range for a small data set.',
      'The learner can explain how an unusual value changes a summary.',
      'The learner can separate describing recorded data from explaining its cause.',
    ],
    draftPath: 'descriptive-statistics.md',
    blockTitle: 'Center, spread, and honest summaries',
    prereqSlugs: ['correlation-and-causation'],
  },
  {
    slug: 'reading-a-research-claim',
    topicTitle: 'Reading a Research Claim',
    topicAliases: ['Evaluating research', 'Evidence claims'],
    summary: 'Trace headlines and wellness claims back to their sample, method, comparison, result, and limits.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 12,
    sourceProvenance: 'Original MWA synthesis referencing NCCIH evidence guidance and OpenStax Psychology 2e methods.',
    subjects: ['Research and Statistics', 'Decision Making'],
    subjectIds: ['research-statistics', 'decision-making'],
    evidenceCriteria: [
      'The learner can ask five questions about a research claim.',
      'The learner can compare a personal story, survey, experiment, and review.',
      'The learner can rewrite a claim using a verb that matches the evidence.',
    ],
    draftPath: 'reading-a-research-claim.md',
    blockTitle: 'From headline to source',
    prereqSlugs: ['descriptive-statistics', 'study-design-basics'],
  },
  {
    slug: 'cognitive-biases-and-decisions',
    topicTitle: 'Cognitive Biases and Decisions',
    topicAliases: ['Thinking biases', 'Judgment and choice'],
    summary: 'Recognize common judgment patterns and use a short pause to make assumptions visible.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 12,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e cognition material.',
    subjects: ['Decision Making', 'Focus'],
    subjectIds: ['decision-making', 'focus'],
    evidenceCriteria: [
      'The learner can define confirmation, availability, anchoring, and present bias.',
      'The learner can identify evidence that would challenge an initial judgment.',
      'The learner can choose when a high-stakes decision deserves more time or review.',
    ],
    draftPath: 'cognitive-biases-and-decisions.md',
    blockTitle: 'Patterns that shape judgment',
    prereqSlugs: ['thinking-and-cognition', 'motivation-and-emotion'],
  },
  {
    slug: 'social-influence-and-groups',
    topicTitle: 'Social Influence and Groups',
    topicAliases: ['Group behavior', 'Social pressure'],
    summary: 'Study how information, belonging, authority, and group structure shape decisions and behavior.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 11,
    sourceProvenance: 'Original MWA synthesis referencing OpenStax Psychology 2e social psychology material.',
    subjects: ['Social Psychology', 'Decision Making'],
    subjectIds: ['social-psychology', 'decision-making'],
    evidenceCriteria: [
      'The learner can distinguish informational, normative, and authority influence.',
      'The learner can identify how a setting changes the pressure on a decision.',
      'The learner can propose one group process that invites independent evidence.',
    ],
    draftPath: 'social-influence-and-groups.md',
    blockTitle: 'Information, belonging, and authority',
    prereqSlugs: ['social-connectedness', 'thinking-and-cognition'],
  },
  {
    slug: 'media-literacy-and-evidence',
    topicTitle: 'Media Literacy and Evidence',
    topicAliases: ['Information literacy', 'Reading media claims'],
    summary: 'Check sources, samples, charts, incentives, and missing context before sharing a surprising claim.',
    intendedAudience: AUDIENCE,
    estimatedMinutes: 12,
    sourceProvenance: 'Original MWA synthesis referencing NCCIH Know the Science and OpenStax Psychology 2e methods.',
    subjects: ['Research and Statistics', 'Social Psychology'],
    subjectIds: ['research-statistics', 'social-psychology'],
    evidenceCriteria: [
      'The learner can identify the claim, source, audience, format, date, and purpose of a message.',
      'The learner can trace a summary back to its original study or dataset.',
      'The learner can write what a source supports and what it leaves unanswered.',
    ],
    draftPath: 'media-literacy-and-evidence.md',
    blockTitle: 'Claims, context, and source trails',
    prereqSlugs: ['reading-a-research-claim', 'cognitive-biases-and-decisions'],
  },
];

function validateDefinitions() {
  const slugs = new Set<string>();
  for (const guide of GUIDES) {
    if (slugs.has(guide.slug)) throw new Error(`Duplicate guide slug: ${guide.slug}`);
    slugs.add(guide.slug);
    if (guide.prereqSlugs.includes(guide.slug)) {
      throw new Error(`Self prerequisite: ${guide.slug}`);
    }
    if (guide.subjectIds.length !== guide.subjects.length) {
      throw new Error(`Subject label/id mismatch: ${guide.slug}`);
    }
  }
}

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\n[\s\S]*?\n---\n+/);
  return (match ? raw.slice(match[0].length) : raw).trim();
}

function loadBody(guide: GuideDef): string {
  return stripFrontmatter(readFileSync(join(DRAFTS_DIR, guide.draftPath), 'utf8'));
}

async function main() {
  validateDefinitions();
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL (or POSTGRES_* vars) not set. Aborting.');
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Planning ${GUIDES.length} guide expansion guides...\n`);
  const idBySlug = new Map<string, string>();

  for (const guide of GUIDES) {
    const existing = await getGuideBySlug(guide.slug);
    if (existing) {
      console.log(`  = ${guide.slug} already exists${REFRESH ? ', refreshing content' : ''}`);
      idBySlug.set(guide.slug, existing.id);
      if (REFRESH && !DRY_RUN) {
        await updateGuide({
          id: existing.id,
          topicTitle: guide.topicTitle,
          topicAliases: guide.topicAliases,
          summary: guide.summary,
          intendedAudience: guide.intendedAudience,
          estimatedMinutes: guide.estimatedMinutes,
          sourceProvenance: guide.sourceProvenance,
          sourceReviewedAt: REVIEW_DATE,
          evidenceCriteria: guide.evidenceCriteria,
          subjectIds: guide.subjectIds,
          body: [{
            id: `${guide.slug}-1`,
            componentType: 'rich_text',
            title: guide.blockTitle,
            config: { format: 'markdown', content: loadBody(guide) },
          }],
        });
      }
      continue;
    }

    const content = loadBody(guide);
    console.log(`  + ${guide.slug} (${content.length} chars)`);
    if (DRY_RUN) {
      idBySlug.set(guide.slug, `dry-run-${guide.slug}`);
      continue;
    }

    const created = await createGuide({
      slug: guide.slug,
      topicTitle: guide.topicTitle,
      topicAliases: guide.topicAliases,
      summary: guide.summary,
      intendedAudience: guide.intendedAudience,
      estimatedMinutes: guide.estimatedMinutes,
      sourceProvenance: guide.sourceProvenance,
      sourceReviewedAt: REVIEW_DATE,
      evidenceCriteria: guide.evidenceCriteria,
      subjectIds: guide.subjectIds,
      status: 'published',
      body: [{
        id: `${guide.slug}-1`,
        componentType: 'rich_text',
        title: guide.blockTitle,
        config: { format: 'markdown', content },
      }],
    });
    idBySlug.set(guide.slug, created.id);
  }

  console.log('\nWiring prerequisite edges...');
  for (const guide of GUIDES) {
    const guideId = idBySlug.get(guide.slug);
    if (!guideId) continue;
    for (const prereqSlug of guide.prereqSlugs) {
      let prereqId = idBySlug.get(prereqSlug);
      if (!prereqId) {
        const prereq = await getGuideBySlug(prereqSlug);
        if (!prereq) {
          throw new Error(`${guide.slug}: prerequisite ${prereqSlug} was not found`);
        }
        prereqId = prereq.id;
        idBySlug.set(prereqSlug, prereqId);
      }
      console.log(`  ${prereqSlug} -> ${guide.slug}`);
      if (!DRY_RUN) await addGuidePrereq(guideId, prereqId);
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Nothing written.' : 'Guide expansion complete.'}`);
}

main().catch((error) => {
  console.error('Guide expansion failed:', error);
  process.exit(1);
});
