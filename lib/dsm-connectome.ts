// Machine-readable DSM symptom-cluster connectome.
//
// A three-tier graph: DSM-5-TR chapters -> disorders -> symptoms. Symptoms are
// deduplicated, so a symptom shared by disorders in different chapters becomes
// a single hub node wired across the graph — that cross-linking is what makes
// the structure a connectome rather than a tree.
//
// `buildConnectome` derives a 0–1 activation for every node from the course
// intake answers and scales each edge by the activation of its endpoints, so
// the same static taxonomy renders as a different live graph per user.
//
// Output is plain JSON: served as-is from /api/connectome and consumed by the
// force-directed dashboard canvas (or any external tool) without a graph lib.

import type { IntakeAnswers } from './personal-course';

export type ConnectomeTier = 'chapter' | 'disorder' | 'symptom';

export interface ConnectomeNode {
  id: string;
  label: string;
  tier: ConnectomeTier;
  /** Chapter id this node belongs to. */
  chapter: string;
  chapterLabel: string;
  color: string;
  /** Derived 0–1 activation for the current user. */
  activation: number;
  /** Number of edges touching this node. */
  degree: number;
}

export interface ConnectomeLink {
  source: string;
  target: string;
  /** 'hierarchy' = taxonomy tree edge, 'comorbid' = cross-chapter co-occurrence. */
  kind: 'hierarchy' | 'comorbid';
  /** Base structural weight 0–1. */
  weight: number;
  /** weight scaled by the activation of both endpoints (0–1). */
  correlation: number;
}

export interface ChapterSummary {
  id: string;
  label: string;
  dsmCluster: string;
  color: string;
  activation: number;
}

export interface Connectome {
  version: string;
  source: 'intake' | 'baseline';
  generatedAt: string;
  nodes: ConnectomeNode[];
  links: ConnectomeLink[];
  chapters: ChapterSummary[];
}

// ── DSM chapters (tier 1) ─────────────────────────────────────────────────
interface ChapterDef {
  id: string;
  label: string;
  dsmCluster: string;
  color: string;
}

const CHAPTERS: ChapterDef[] = [
  { id: 'depressive', label: 'Depressive', dsmCluster: 'Depressive Disorders', color: '#5168FF' },
  { id: 'anxiety', label: 'Anxiety', dsmCluster: 'Anxiety Disorders', color: '#C084FC' },
  { id: 'trauma', label: 'Trauma & Stress', dsmCluster: 'Trauma- & Stressor-Related', color: '#E8556D' },
  { id: 'sleep', label: 'Sleep–Wake', dsmCluster: 'Sleep–Wake Disorders', color: '#3D8BFF' },
  { id: 'neuro', label: 'Neurodevelopmental', dsmCluster: 'Neurodevelopmental Disorders', color: '#7B8FFF' },
  { id: 'ocd', label: 'Obsessive-Compulsive', dsmCluster: 'OCD & Related Disorders', color: '#2DB5A8' },
  { id: 'somatic', label: 'Somatic Symptom', dsmCluster: 'Somatic Symptom Disorders', color: '#FF8844' },
];

// ── Disorders (tier 2) with their symptom ids (tier 3) ────────────────────
interface DisorderDef {
  id: string;
  label: string;
  chapter: string;
  symptoms: string[];
}

const DISORDERS: DisorderDef[] = [
  // Depressive
  { id: 'mdd', label: 'Major Depressive', chapter: 'depressive',
    symptoms: ['low-mood', 'anhedonia', 'fatigue', 'worthlessness', 'sleep-disturbance', 'appetite-change', 'concentration-loss', 'suicidal-thoughts', 'psychomotor'] },
  { id: 'pdd', label: 'Persistent Depressive', chapter: 'depressive',
    symptoms: ['low-mood', 'fatigue', 'low-self-esteem', 'concentration-loss', 'hopelessness', 'appetite-change'] },
  { id: 'pmdd', label: 'Premenstrual Dysphoric', chapter: 'depressive',
    symptoms: ['irritability', 'mood-swings', 'anxiety-tension', 'fatigue', 'appetite-change'] },
  { id: 'dmdd', label: 'Disruptive Mood Dysregulation', chapter: 'depressive',
    symptoms: ['irritability', 'temper-outbursts', 'mood-swings'] },
  // Anxiety
  { id: 'gad', label: 'Generalized Anxiety', chapter: 'anxiety',
    symptoms: ['excessive-worry', 'restlessness', 'fatigue', 'concentration-loss', 'irritability', 'muscle-tension', 'sleep-disturbance'] },
  { id: 'panic', label: 'Panic Disorder', chapter: 'anxiety',
    symptoms: ['panic-attacks', 'palpitations', 'shortness-breath', 'dizziness', 'fear-of-fear', 'derealization'] },
  { id: 'social-anx', label: 'Social Anxiety', chapter: 'anxiety',
    symptoms: ['social-fear', 'social-avoidance', 'blushing', 'performance-fear', 'anticipatory-anxiety'] },
  { id: 'agora', label: 'Agoraphobia', chapter: 'anxiety',
    symptoms: ['situational-avoidance', 'panic-attacks', 'fear-of-fear'] },
  { id: 'sep-anx', label: 'Separation Anxiety', chapter: 'anxiety',
    symptoms: ['separation-distress', 'excessive-worry', 'sleep-disturbance'] },
  // Trauma & stressor-related
  { id: 'ptsd', label: 'PTSD', chapter: 'trauma',
    symptoms: ['flashbacks', 'nightmares', 'hypervigilance', 'emotional-numbing', 'startle-response', 'trauma-avoidance', 'intrusive-memories', 'negative-beliefs', 'irritability'] },
  { id: 'asd', label: 'Acute Stress', chapter: 'trauma',
    symptoms: ['intrusive-memories', 'dissociation', 'sleep-disturbance', 'hypervigilance', 'trauma-avoidance'] },
  { id: 'adjust', label: 'Adjustment Disorder', chapter: 'trauma',
    symptoms: ['low-mood', 'excessive-worry', 'situational-avoidance', 'hopelessness'] },
  { id: 'rad', label: 'Reactive Attachment', chapter: 'trauma',
    symptoms: ['emotional-numbing', 'social-avoidance', 'irritability'] },
  // Sleep–wake
  { id: 'insomnia-d', label: 'Insomnia Disorder', chapter: 'sleep',
    symptoms: ['insomnia', 'early-waking', 'restless-sleep', 'daytime-sleepiness', 'fatigue', 'concentration-loss'] },
  { id: 'hypersomnia', label: 'Hypersomnolence', chapter: 'sleep',
    symptoms: ['hypersomnia', 'daytime-sleepiness', 'non-restorative-sleep', 'fatigue'] },
  { id: 'nightmare-d', label: 'Nightmare Disorder', chapter: 'sleep',
    symptoms: ['nightmares', 'restless-sleep', 'sleep-disturbance'] },
  { id: 'circadian', label: 'Circadian Rhythm', chapter: 'sleep',
    symptoms: ['delayed-sleep', 'daytime-sleepiness', 'insomnia'] },
  // Neurodevelopmental
  { id: 'adhd', label: 'ADHD', chapter: 'neuro',
    symptoms: ['inattention', 'distractibility', 'hyperactivity', 'impulsivity', 'task-avoidance', 'time-blindness', 'concentration-loss', 'restlessness'] },
  { id: 'autism', label: 'Autism Spectrum', chapter: 'neuro',
    symptoms: ['social-communication', 'sensory-sensitivity', 'routine-need', 'social-avoidance'] },
  { id: 'sld', label: 'Specific Learning Disorder', chapter: 'neuro',
    symptoms: ['concentration-loss', 'task-avoidance', 'distractibility'] },
  // Obsessive-compulsive & related
  { id: 'ocd-d', label: 'Obsessive-Compulsive', chapter: 'ocd',
    symptoms: ['obsessions', 'compulsions', 'checking', 'contamination-fear', 'symmetry-need', 'intrusive-thoughts', 'reassurance-seeking'] },
  { id: 'bdd', label: 'Body Dysmorphic', chapter: 'ocd',
    symptoms: ['appearance-preoccupation', 'body-checking', 'reassurance-seeking', 'social-avoidance'] },
  { id: 'hoarding', label: 'Hoarding Disorder', chapter: 'ocd',
    symptoms: ['hoarding-behavior', 'indecision', 'distress-discarding'] },
  { id: 'excoriation', label: 'Excoriation', chapter: 'ocd',
    symptoms: ['skin-picking', 'compulsions', 'tension-relief'] },
  // Somatic symptom & related
  { id: 'ssd', label: 'Somatic Symptom', chapter: 'somatic',
    symptoms: ['physical-pain', 'health-worry', 'fatigue', 'body-checking', 'gi-distress'] },
  { id: 'iad', label: 'Illness Anxiety', chapter: 'somatic',
    symptoms: ['health-worry', 'body-checking', 'reassurance-seeking', 'excessive-worry'] },
  { id: 'conversion', label: 'Conversion Disorder', chapter: 'somatic',
    symptoms: ['sensory-symptoms', 'physical-pain', 'dizziness'] },
];

// ── Symptom labels (tier 3) ───────────────────────────────────────────────
const SYMPTOM_LABELS: Record<string, string> = {
  'low-mood': 'Low mood',
  anhedonia: 'Loss of interest',
  fatigue: 'Fatigue',
  worthlessness: 'Worthlessness',
  'sleep-disturbance': 'Disturbed sleep',
  'appetite-change': 'Appetite change',
  'concentration-loss': 'Poor concentration',
  'suicidal-thoughts': 'Suicidal thoughts',
  psychomotor: 'Psychomotor change',
  'low-self-esteem': 'Low self-esteem',
  hopelessness: 'Hopelessness',
  irritability: 'Irritability',
  'mood-swings': 'Mood swings',
  'anxiety-tension': 'Inner tension',
  'temper-outbursts': 'Temper outbursts',
  'excessive-worry': 'Excessive worry',
  restlessness: 'Restlessness',
  'muscle-tension': 'Muscle tension',
  'panic-attacks': 'Panic attacks',
  palpitations: 'Palpitations',
  'shortness-breath': 'Shortness of breath',
  dizziness: 'Dizziness',
  'fear-of-fear': 'Fear of fear',
  derealization: 'Derealization',
  'social-fear': 'Fear of judgment',
  'social-avoidance': 'Social withdrawal',
  blushing: 'Visible anxiety',
  'performance-fear': 'Performance anxiety',
  'anticipatory-anxiety': 'Anticipatory anxiety',
  'situational-avoidance': 'Situational avoidance',
  'separation-distress': 'Separation distress',
  flashbacks: 'Flashbacks',
  nightmares: 'Nightmares',
  hypervigilance: 'Hypervigilance',
  'emotional-numbing': 'Emotional numbing',
  'startle-response': 'Exaggerated startle',
  'trauma-avoidance': 'Avoidance of reminders',
  'intrusive-memories': 'Intrusive memories',
  'negative-beliefs': 'Negative self-beliefs',
  dissociation: 'Dissociation',
  insomnia: 'Insomnia',
  'early-waking': 'Early-morning waking',
  'restless-sleep': 'Restless sleep',
  'daytime-sleepiness': 'Daytime sleepiness',
  hypersomnia: 'Hypersomnia',
  'non-restorative-sleep': 'Non-restorative sleep',
  'delayed-sleep': 'Delayed sleep phase',
  inattention: 'Inattention',
  distractibility: 'Distractibility',
  hyperactivity: 'Hyperactivity',
  impulsivity: 'Impulsivity',
  'task-avoidance': 'Task avoidance',
  'time-blindness': 'Time blindness',
  'social-communication': 'Social communication',
  'sensory-sensitivity': 'Sensory sensitivity',
  'routine-need': 'Need for routine',
  obsessions: 'Obsessions',
  compulsions: 'Compulsions',
  checking: 'Checking rituals',
  'contamination-fear': 'Contamination fear',
  'symmetry-need': 'Need for symmetry',
  'intrusive-thoughts': 'Intrusive thoughts',
  'reassurance-seeking': 'Reassurance seeking',
  'appearance-preoccupation': 'Appearance preoccupation',
  'body-checking': 'Body checking',
  'hoarding-behavior': 'Difficulty discarding',
  indecision: 'Indecisiveness',
  'distress-discarding': 'Distress discarding',
  'skin-picking': 'Skin picking',
  'tension-relief': 'Tension-relief behavior',
  'physical-pain': 'Unexplained pain',
  'health-worry': 'Health worry',
  'gi-distress': 'Gut distress',
  'sensory-symptoms': 'Neurological symptoms',
};

// ── Cross-chapter comorbidity edges (tier 1 ↔ tier 1) ─────────────────────
// Weights approximate documented DSM cross-cluster co-occurrence rates.
const COMORBID: { source: string; target: string; weight: number }[] = [
  { source: 'depressive', target: 'anxiety', weight: 0.84 },
  { source: 'depressive', target: 'sleep', weight: 0.78 },
  { source: 'depressive', target: 'trauma', weight: 0.68 },
  { source: 'depressive', target: 'somatic', weight: 0.6 },
  { source: 'depressive', target: 'neuro', weight: 0.5 },
  { source: 'depressive', target: 'ocd', weight: 0.52 },
  { source: 'anxiety', target: 'sleep', weight: 0.7 },
  { source: 'anxiety', target: 'trauma', weight: 0.66 },
  { source: 'anxiety', target: 'somatic', weight: 0.62 },
  { source: 'anxiety', target: 'ocd', weight: 0.64 },
  { source: 'anxiety', target: 'neuro', weight: 0.48 },
  { source: 'trauma', target: 'sleep', weight: 0.62 },
  { source: 'trauma', target: 'somatic', weight: 0.5 },
  { source: 'sleep', target: 'somatic', weight: 0.54 },
  { source: 'sleep', target: 'neuro', weight: 0.44 },
];

const HIERARCHY_CHAPTER_WEIGHT = 0.72;
const HIERARCHY_SYMPTOM_WEIGHT = 0.56;

// ── Static skeleton — built once at module load ───────────────────────────
interface Skeleton {
  nodes: Omit<ConnectomeNode, 'activation'>[];
  links: Omit<ConnectomeLink, 'correlation'>[];
}

function buildSkeleton(): Skeleton {
  const chapterById = new Map(CHAPTERS.map((c) => [c.id, c]));
  const nodes: Omit<ConnectomeNode, 'activation'>[] = [];
  const links: Omit<ConnectomeLink, 'correlation'>[] = [];
  const degree = new Map<string, number>();
  const bump = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1);

  // Tier 1 — chapters.
  for (const chapter of CHAPTERS) {
    nodes.push({
      id: chapter.id,
      label: chapter.label,
      tier: 'chapter',
      chapter: chapter.id,
      chapterLabel: chapter.label,
      color: chapter.color,
      degree: 0,
    });
  }

  // Tier 2 — disorders, plus tier-3 symptoms (deduplicated).
  const symptomChapter = new Map<string, string>();
  for (const disorder of DISORDERS) {
    const chapter = chapterById.get(disorder.chapter);
    if (!chapter) continue;
    nodes.push({
      id: disorder.id,
      label: disorder.label,
      tier: 'disorder',
      chapter: chapter.id,
      chapterLabel: chapter.label,
      color: chapter.color,
      degree: 0,
    });
    links.push({ source: chapter.id, target: disorder.id, kind: 'hierarchy', weight: HIERARCHY_CHAPTER_WEIGHT });
    bump(chapter.id);
    bump(disorder.id);

    for (const symptomId of disorder.symptoms) {
      if (!symptomChapter.has(symptomId)) {
        symptomChapter.set(symptomId, chapter.id);
        nodes.push({
          id: symptomId,
          label: SYMPTOM_LABELS[symptomId] ?? symptomId,
          tier: 'symptom',
          chapter: chapter.id,
          chapterLabel: chapter.label,
          color: chapter.color,
          degree: 0,
        });
      }
      links.push({ source: disorder.id, target: symptomId, kind: 'hierarchy', weight: HIERARCHY_SYMPTOM_WEIGHT });
      bump(disorder.id);
      bump(symptomId);
    }
  }

  // Tier 1 ↔ tier 1 — comorbidity.
  for (const edge of COMORBID) {
    links.push({ ...edge, kind: 'comorbid' });
    bump(edge.source);
    bump(edge.target);
  }

  for (const node of nodes) node.degree = degree.get(node.id) ?? 0;
  return { nodes, links };
}

const SKELETON = buildSkeleton();

// ── Activation derivation ─────────────────────────────────────────────────
const BASELINE = 0.3;
const MIN_ACTIVATION = 0.08;

// Each goal nudges the DSM chapters it tends to surface.
const GOAL_DELTAS: Record<string, Partial<Record<string, number>>> = {
  Healing: { trauma: 0.34, depressive: 0.2, somatic: 0.12 },
  Wellness: { sleep: 0.16, somatic: 0.16, depressive: 0.08 },
  Exercise: { somatic: 0.22, sleep: 0.1, depressive: 0.06 },
  Creativity: { neuro: 0.18, depressive: 0.1 },
};

// Free-text intake ("about you") is scanned for these chapter keywords.
const KEYWORD_CHAPTERS: Record<string, string[]> = {
  anxiety: ['anxious', 'anxiety', 'panic', 'worry', 'worried', 'nervous', 'on edge', 'dread'],
  depressive: ['sad', 'depress', 'hopeless', 'empty', 'numb', 'unmotivated', 'down', 'low mood'],
  sleep: ['sleep', 'insomnia', 'awake', 'restless', 'nightmare'],
  neuro: ['focus', 'distract', 'adhd', 'procrastinat', 'scattered', 'forget', 'overwhelm'],
  trauma: ['trauma', 'grief', 'grieving', 'loss', 'abuse', 'ptsd', 'flashback'],
  ocd: ['obsess', 'compuls', 'checking', 'intrusive', 'ritual'],
  somatic: ['exhaust', 'fatigue', 'burnout', 'burnt out', 'drained', 'ache', 'pain', 'sick'],
};

const KEYWORD_STEP = 0.12;
const KEYWORD_CAP = 0.36;

function clamp01(value: number): number {
  return Math.min(1, Math.max(MIN_ACTIVATION, value));
}

// Deterministic 0–1 hash so disorder/symptom variance is stable per id.
function hash01(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Derive a 0–1 activation per DSM chapter from the intake answers. */
export function deriveChapterActivation(intake?: IntakeAnswers): Record<string, number> {
  const activation: Record<string, number> = {};
  for (const chapter of CHAPTERS) activation[chapter.id] = BASELINE;
  if (!intake) return activation;

  const add = (id: string, delta: number) => {
    if (id in activation) activation[id] += delta;
  };

  const goalDeltas = GOAL_DELTAS[intake.goal];
  if (goalDeltas) {
    for (const [id, delta] of Object.entries(goalDeltas)) add(id, delta ?? 0);
  }

  if (intake.accountability === 'Prefers to work solo') add('anxiety', 0.2);
  if (intake.accountability === 'Gentle check-ins help') add('anxiety', 0.1);

  if (intake.meetups === 'Prefers a self-paced path') add('anxiety', 0.18);
  else if (intake.meetups === 'Open to meet-ups later') add('anxiety', 0.06);

  if (intake.timeCommitment === 'About 10 minutes a day') {
    add('somatic', 0.16);
    add('neuro', 0.16);
    add('depressive', 0.06);
  }

  if (intake.experience === 'New to reflective practice') {
    add('anxiety', 0.1);
    add('depressive', 0.08);
  }

  const voice = (intake.voiceContext || '').toLowerCase();
  if (voice) {
    for (const [id, keywords] of Object.entries(KEYWORD_CHAPTERS)) {
      let hits = 0;
      for (const word of keywords) if (voice.includes(word)) hits += 1;
      if (hits > 0) add(id, Math.min(KEYWORD_CAP, hits * KEYWORD_STEP));
    }
  }

  for (const id of Object.keys(activation)) activation[id] = clamp01(activation[id]);
  return activation;
}

/** Build the full three-tier connectome with per-node activation. */
export function buildConnectome(intake?: IntakeAnswers): Connectome {
  const hasAnswers = Boolean(intake && Object.keys(intake).length > 0);
  const chapterActivation = deriveChapterActivation(hasAnswers ? intake : undefined);

  // Disorder activation: chapter level with a stable per-disorder variance.
  const disorderActivation = new Map<string, number>();
  for (const disorder of DISORDERS) {
    const base = chapterActivation[disorder.chapter] ?? BASELINE;
    disorderActivation.set(disorder.id, clamp01(base * (0.62 + hash01(disorder.id) * 0.4)));
  }

  // Symptom activation: mean of every disorder that references it.
  const symptomSums = new Map<string, { total: number; count: number }>();
  for (const disorder of DISORDERS) {
    const act = disorderActivation.get(disorder.id) ?? BASELINE;
    for (const symptomId of disorder.symptoms) {
      const entry = symptomSums.get(symptomId) ?? { total: 0, count: 0 };
      entry.total += act;
      entry.count += 1;
      symptomSums.set(symptomId, entry);
    }
  }

  const activationOf = (node: Omit<ConnectomeNode, 'activation'>): number => {
    if (node.tier === 'chapter') return chapterActivation[node.id] ?? BASELINE;
    if (node.tier === 'disorder') return disorderActivation.get(node.id) ?? BASELINE;
    const entry = symptomSums.get(node.id);
    return entry && entry.count > 0 ? clamp01(entry.total / entry.count) : BASELINE;
  };

  const nodes: ConnectomeNode[] = SKELETON.nodes.map((node) => ({
    ...node,
    activation: Number(activationOf(node).toFixed(3)),
  }));
  const activationById = new Map(nodes.map((n) => [n.id, n.activation]));

  const links: ConnectomeLink[] = SKELETON.links.map((link) => {
    const a = activationById.get(link.source) ?? BASELINE;
    const b = activationById.get(link.target) ?? BASELINE;
    return {
      ...link,
      correlation: Number((link.weight * Math.sqrt(a * b)).toFixed(3)),
    };
  });

  const chapters: ChapterSummary[] = CHAPTERS.map((chapter) => ({
    id: chapter.id,
    label: chapter.label,
    dsmCluster: chapter.dsmCluster,
    color: chapter.color,
    activation: Number((chapterActivation[chapter.id] ?? BASELINE).toFixed(3)),
  }));

  return {
    version: '2.0',
    source: hasAnswers ? 'intake' : 'baseline',
    generatedAt: new Date().toISOString(),
    nodes,
    links,
    chapters,
  };
}
