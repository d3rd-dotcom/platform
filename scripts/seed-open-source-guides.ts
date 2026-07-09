/**
 * Seeds 20 new published guides into the guides knowledge DAG from the
 * plain-reformatted open-source drafts in content/guide-drafts/ (see
 * content/open-sources/README.md and content/guide-drafts/overlap-resolution-log.md
 * for provenance — public-domain NIMH/MedlinePlus/CDC content plus CC BY
 * OpenStax Psychology 2e chapters, attributed inline where required).
 *
 * Wires the new guides into the existing DAG's two primitives
 * (attention-basics, emotional-vocabulary from db/seed-guides.sql) so the
 * landing page's knowledge graph grows from a connected tree, not a
 * disjoint cluster. All edges point from lower to higher level by
 * construction — the guide_edges_cycle_check trigger is the real
 * enforcement, this is just written to agree with it.
 *
 * MIT OCW sources are intentionally excluded (CC BY-NC-SA — reference/
 * structuring use only, not for verbatim publish in a paywalled/credit-gated
 * product until the license question is resolved).
 *
 * Idempotent: looks up each guide by slug before inserting (createGuide has
 * no ON CONFLICT), and subjects/edges already use ON CONFLICT DO NOTHING —
 * safe to re-run.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/seed-open-source-guides.ts
 *   npx tsx --env-file=.env.local scripts/seed-open-source-guides.ts --dry-run
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { isDbConfigured, sqlQuery } from '../lib/db';
import { createGuide, getGuideBySlug, setGuideSubjects, addGuidePrereq } from '../lib/guides-db';

const DRY_RUN = process.argv.includes('--dry-run');
const DRAFTS_DIR = join(__dirname, '..', 'content', 'guide-drafts');

interface GuideDef {
  slug: string;
  topicTitle: string;
  subjects: string[];
  draftPath: string; // relative to DRAFTS_DIR
  blockTitle: string;
  attribution?: string; // CC BY sources only
  prereqSlugs: string[]; // may reference existing guides or guides defined in this file
}

const GUIDES: GuideDef[] = [
  // ── Level 0 (new primitives, no prereqs) ─────────────────────────────────
  {
    slug: 'states-of-consciousness',
    topicTitle: 'States of Consciousness',
    subjects: ['Focus', 'Foundations'],
    draftPath: 'openstax-psychology/ch04-states-of-consciousness.md',
    blockTitle: 'Awareness, sleep, and circadian rhythm',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: [],
  },
  {
    slug: 'motivation-and-emotion',
    topicTitle: 'Motivation and Emotion',
    subjects: ['Emotional Regulation', 'Foundations'],
    draftPath: 'openstax-psychology/ch10-motivation-and-emotion.md',
    blockTitle: 'What emotion is and where it comes from',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: [],
  },
  {
    slug: 'personality-basics',
    topicTitle: 'Personality Basics',
    subjects: ['Emotional Regulation', 'Foundations'],
    draftPath: 'openstax-psychology/ch11-personality.md',
    blockTitle: 'How personality theory developed',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: [],
  },
  {
    slug: 'memory-and-recall',
    topicTitle: 'Memory and Recall',
    subjects: ['Focus', 'Foundations'],
    draftPath: 'openstax-psychology/ch08-memory.md',
    blockTitle: 'How to move information into long-term memory',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: [],
  },
  {
    slug: 'thinking-and-cognition',
    topicTitle: 'Thinking and Cognition',
    subjects: ['Focus', 'Foundations'],
    draftPath: 'openstax-psychology/ch07-thinking-and-intelligence.md',
    blockTitle: 'Concepts, prototypes, and schemata',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: [],
  },

  // ── Level 1 ───────────────────────────────────────────────────────────────
  {
    slug: 'operant-conditioning-and-habits',
    topicTitle: 'Operant Conditioning and Habits',
    subjects: ['Habits', 'Focus'],
    draftPath: 'openstax-psychology/ch06-learning.md',
    blockTitle: 'How behavior changes based on its consequences',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: ['attention-basics', 'memory-and-recall'],
  },
  {
    slug: 'stress-basics',
    topicTitle: 'Stress Basics',
    subjects: ['Emotional Regulation', 'Coping'],
    draftPath: 'cdc/managing-stress.md',
    blockTitle: 'Recognizing stress and caring for mind and body',
    prereqSlugs: ['emotional-vocabulary'],
  },
  {
    slug: 'anxiety-basics',
    topicTitle: 'Anxiety Basics',
    subjects: ['Emotional Regulation', 'Coping'],
    draftPath: 'medlineplus/anxiety.md',
    blockTitle: 'Telling useful anxiety from the kind that overwhelms',
    prereqSlugs: ['stress-basics'],
  },
  {
    slug: 'adhd-and-focus',
    topicTitle: 'ADHD and Focus',
    subjects: ['Focus'],
    draftPath: 'medlineplus/adhd.md',
    blockTitle: 'When attention differences go beyond normal distraction',
    prereqSlugs: ['attention-basics', 'thinking-and-cognition'],
  },
  {
    slug: 'sleep-basics',
    topicTitle: 'Sleep Basics',
    subjects: ['Habits', 'Foundations'],
    draftPath: 'medlineplus/healthy-sleep.md',
    blockTitle: 'What sleep does for you and how to get better rest',
    prereqSlugs: ['stress-basics'],
  },
  {
    slug: 'mental-health-foundations',
    topicTitle: 'Mental Health Foundations',
    subjects: ['Foundations', 'Emotional Regulation'],
    draftPath: 'medlineplus/how-to-improve-mental-health.md',
    blockTitle: 'What mental health is and why it matters',
    prereqSlugs: ['emotional-vocabulary'],
  },
  {
    slug: 'self-care-techniques',
    topicTitle: 'Self-Care Techniques',
    subjects: ['Emotional Regulation', 'Habits'],
    draftPath: 'nimh/caring-for-your-mental-health.md',
    blockTitle: 'Small, repeatable acts of self-care',
    prereqSlugs: ['mental-health-foundations'],
  },

  // ── Level 2 ───────────────────────────────────────────────────────────────
  {
    slug: 'depression-basics',
    topicTitle: 'Depression Basics',
    subjects: ['Emotional Regulation', 'Coping'],
    draftPath: 'medlineplus/depression.md',
    blockTitle: 'How depression differs from ordinary sadness',
    prereqSlugs: ['stress-basics', 'mental-health-foundations', 'motivation-and-emotion'],
  },
  {
    slug: 'mood-disorders-overview',
    topicTitle: 'Mood Disorders Overview',
    subjects: ['Emotional Regulation'],
    draftPath: 'medlineplus/mood-disorders.md',
    blockTitle: 'When a mood becomes a lasting pattern',
    prereqSlugs: ['depression-basics', 'anxiety-basics', 'personality-basics'],
  },
  {
    slug: 'building-daily-habits-with-movement',
    topicTitle: 'Building Daily Habits With Movement',
    subjects: ['Habits'],
    draftPath: 'cdc/physical-activity-benefits.md',
    blockTitle: 'What regular activity does for your brain and body',
    prereqSlugs: ['operant-conditioning-and-habits'],
  },
  {
    slug: 'social-connectedness',
    topicTitle: 'Social Connectedness',
    subjects: ['Emotional Regulation', 'Reflection'],
    draftPath: 'cdc/social-connectedness.md',
    blockTitle: 'Why relationships change health outcomes',
    prereqSlugs: ['mental-health-foundations'],
  },
  {
    slug: 'coping-with-chronic-illness',
    topicTitle: 'Coping With Chronic Illness',
    subjects: ['Coping', 'Emotional Regulation'],
    draftPath: 'medlineplus/coping-with-chronic-illness.md',
    blockTitle: 'Regaining a sense of control',
    prereqSlugs: ['self-care-techniques', 'stress-basics'],
  },
  {
    slug: 'coping-with-traumatic-events',
    topicTitle: 'Coping With Traumatic Events',
    subjects: ['Coping', 'Emotional Regulation'],
    draftPath: 'nimh/coping-with-traumatic-events.md',
    blockTitle: 'Common reactions after trauma and healthy ways to cope',
    prereqSlugs: ['self-care-techniques', 'anxiety-basics', 'states-of-consciousness'],
  },
  {
    slug: 'mental-health-check-in',
    topicTitle: 'Mental Health Check-In',
    subjects: ['Reflection', 'Coping'],
    draftPath: 'nimh/my-mental-health-do-i-need-help.md',
    blockTitle: 'Noticing how you have been feeling',
    prereqSlugs: ['mental-health-foundations', 'depression-basics'],
  },
  {
    slug: 'stress-lifestyle-and-health',
    topicTitle: 'Stress, Lifestyle, and Health',
    subjects: ['Emotional Regulation', 'Habits'],
    draftPath: 'openstax-psychology/ch14-stress-lifestyle-and-health.md',
    blockTitle: 'Coping styles, perceived control, and social support',
    attribution: 'Adapted from OpenStax Psychology 2e (CC BY 4.0).',
    prereqSlugs: ['stress-basics', 'sleep-basics'],
  },
];

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\n[\s\S]*?\n---\n+/);
  const body = match ? raw.slice(match[0].length) : raw;
  return body.trim();
}

function loadBody(def: GuideDef): string {
  const raw = readFileSync(join(DRAFTS_DIR, def.draftPath), 'utf-8');
  let content = stripFrontmatter(raw);
  if (def.attribution) {
    content += `\n\n*${def.attribution}*`;
  }
  return content;
}

async function main() {
  if (!isDbConfigured()) {
    console.error('DATABASE_URL (or POSTGRES_* vars) not set. Aborting.');
    process.exit(1);
  }

  console.log(`${DRY_RUN ? '[DRY RUN] ' : ''}Seeding ${GUIDES.length} open-source guides...\n`);

  const idBySlug = new Map<string, string>();

  // Pass 1: guides (no edges yet, so insertion order doesn't matter for FKs)
  for (const def of GUIDES) {
    const existing = await getGuideBySlug(def.slug);
    if (existing) {
      console.log(`  = ${def.slug} already exists, skipping create`);
      idBySlug.set(def.slug, existing.id);
      continue;
    }

    const content = loadBody(def);
    console.log(`  + ${def.slug}  ("${def.topicTitle}", ${content.length} chars)`);

    if (DRY_RUN) {
      idBySlug.set(def.slug, `dry-run-${def.slug}`);
      continue;
    }

    const guide = await createGuide({
      slug: def.slug,
      topicTitle: def.topicTitle,
      status: 'published',
      body: [
        {
          id: `${def.slug}-1`,
          componentType: 'rich_text',
          title: def.blockTitle,
          config: { format: 'markdown', content },
        },
      ],
    });
    idBySlug.set(def.slug, guide.id);
  }

  // Pass 2: subjects
  console.log('\nSetting subjects...');
  for (const def of GUIDES) {
    if (DRY_RUN) continue;
    const id = idBySlug.get(def.slug);
    if (!id) continue;
    await setGuideSubjects(id, def.subjects);
  }

  // Pass 3: edges (existing guides resolved via getGuideBySlug fallback)
  console.log('\nWiring prerequisite edges...');
  for (const def of GUIDES) {
    const guideId = idBySlug.get(def.slug);
    if (!guideId) continue;

    for (const prereqSlug of def.prereqSlugs) {
      let prereqId = idBySlug.get(prereqSlug);
      if (!prereqId) {
        const prereqGuide = await getGuideBySlug(prereqSlug);
        if (!prereqGuide) {
          console.warn(`  ! ${def.slug}: prereq "${prereqSlug}" not found, skipping edge`);
          continue;
        }
        prereqId = prereqGuide.id;
        idBySlug.set(prereqSlug, prereqId);
      }

      console.log(`  ${prereqSlug} -> ${def.slug}`);
      if (DRY_RUN) continue;

      try {
        await addGuidePrereq(guideId, prereqId);
      } catch (error) {
        console.error(`  ! Edge ${prereqSlug} -> ${def.slug} rejected:`, (error as Error).message);
      }
    }
  }

  console.log(`\n${DRY_RUN ? '[DRY RUN] Nothing written.' : 'Done.'}`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
