import { createHash } from 'crypto';
import type { GuideBodyComponent } from './guides-db';

/**
 * Deterministic Assembly-Theory decomposition of a guide body.
 *
 * A guide's body (course-component JSONB) is broken into SECTIONS ("assemblies")
 * — one per text-bearing component — and each section into ATOMIC CLAIMS
 * ("axioms") by sentence splitting. The result is pure and stable: the same body
 * always yields the same sections, axioms, hashes, and contentVersion, so the DB
 * layer can materialize once and re-materialize only when the body actually
 * changes.
 *
 * This module never touches the database and never mints anything — it is the
 * text→structure step alone. The reward money path lives in lib/guide-rewards-db.ts.
 */

// Algorithm tag: bump when the decomposition logic changes so every guide's
// contentVersion busts and re-materializes on next read.
const ALGO_VERSION = 'assembly-v1';

// An axiom must clear these bars to be a standalone claim worth a verdict card.
const MIN_AXIOM_CHARS = 24;
const MIN_AXIOM_WORDS = 4;

// Keep a pass finishable: cap cards per section and overall (deterministic head
// truncation). A 200-sentence guide would otherwise be an unwinnable slog.
const MAX_AXIOMS_PER_SECTION = 14;
const MAX_TOTAL_AXIOMS = 64;
const MAX_SECTIONS = 16;

// Periods that end these do not end a sentence.
const ABBREVIATIONS = [
  'e.g', 'i.e', 'etc', 'vs', 'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr',
  'st', 'no', 'fig', 'al', 'ca', 'cf', 'approx', 'dept', 'est', 'inc', 'ltd',
  'u.s', 'u.k', 'ph.d', 'a.m', 'p.m', 'i.q', 'a.k.a',
];

export interface DecomposedAxiom {
  /** The clean, display-ready claim sentence. */
  statement: string;
  /** sha256 of the normalized statement — cross-guide reuse/dedup signal. */
  hash: string;
}

export interface DecomposedSection {
  /** Section heading; null when the source title was empty or echoed the guide title. */
  label: string | null;
  axioms: DecomposedAxiom[];
}

export interface AssemblyDraft {
  /** sha256 over the whole decomposition — the guide-body revision fingerprint. */
  contentVersion: string;
  sections: DecomposedSection[];
  axiomCount: number;
}

// ── Text extraction ──────────────────────────────────────────────────────────

const TEXT_KEYS = ['content', 'text', 'markdown', 'body', 'copy', 'description'];

function collectStrings(value: unknown, out: string[], depth = 0): void {
  if (depth > 4 || value == null) return;
  if (typeof value === 'string') {
    if (value.trim()) out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const key of TEXT_KEYS) {
      const v = (value as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) out.push(v);
    }
    // Recurse into nested block arrays (rich components nest their prose).
    const blocks = (value as Record<string, unknown>).blocks;
    if (Array.isArray(blocks)) collectStrings(blocks, out, depth + 1);
  }
}

/** Pull the prose out of one body component, in document order. */
function componentText(component: GuideBodyComponent): string {
  const parts: string[] = [];
  collectStrings(component.config, parts);
  if (Array.isArray(component.blocks)) collectStrings(component.blocks, parts);
  return parts.join('\n\n');
}

/** Strip lightweight markdown to plain prose (mirrors guides-db deriveSummary). */
function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, ' ') // fenced code
    .replace(/`([^`]+)`/g, '$1') // inline code
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
    .replace(/^\s{0,3}>\s?/gm, '') // blockquotes
    .replace(/^#{1,6}\s+/gm, '') // heading markers
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*]+)\*/g, '$1') // italic
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // links → text
    .replace(/^\s*[-*+]\s+/gm, '') // list bullets
    .replace(/^\s*\d+\.\s+/gm, '') // ordered list markers
    .replace(/[|]/g, ' ') // table pipes
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Sentence splitting ───────────────────────────────────────────────────────

const DOT = '';
const ELLIPSIS = '';

function splitSentences(text: string): string[] {
  let s = stripMarkdown(text);
  if (!s) return [];

  // Protect decimals (3.5), ellipses, and abbreviation periods from the splitter.
  s = s.replace(/(\d)\.(\d)/g, `$1${DOT}$2`);
  s = s.replace(/\.{3,}/g, ELLIPSIS);
  for (const abbr of ABBREVIATIONS) {
    const re = new RegExp(`\\b${abbr.replace(/\./g, '\\.')}\\.`, 'gi');
    s = s.replace(re, (m) => m.replace(/\./g, DOT));
  }

  // Split after . ! ? when followed by whitespace and a likely sentence start.
  const parts = s.split(/(?<=[.!?])\s+(?=["'“(]?[A-Z0-9])/);

  return parts
    .map((p) => p.replace(new RegExp(DOT, 'g'), '.').replace(new RegExp(ELLIPSIS, 'g'), '...').trim())
    .filter(Boolean);
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function isAxiom(sentence: string): boolean {
  return sentence.length >= MIN_AXIOM_CHARS && wordCount(sentence) >= MIN_AXIOM_WORDS;
}

// ── Normalization + hashing ──────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Decompose a guide body into sections of axioms. Deterministic and side-effect
 * free. Sections that yield no axioms are dropped; a body with no prose yields
 * zero sections (axiomCount === 0), which the callers treat as "no game here".
 */
export function decomposeGuideBody(
  body: GuideBodyComponent[],
  topicTitle: string,
): AssemblyDraft {
  const titleKey = normalize(topicTitle);
  const sections: DecomposedSection[] = [];
  let total = 0;

  for (const component of Array.isArray(body) ? body : []) {
    if (sections.length >= MAX_SECTIONS || total >= MAX_TOTAL_AXIOMS) break;

    const sentences = splitSentences(componentText(component));
    const seen = new Set<string>();
    const axioms: DecomposedAxiom[] = [];

    for (const sentence of sentences) {
      if (axioms.length >= MAX_AXIOMS_PER_SECTION || total >= MAX_TOTAL_AXIOMS) break;
      if (!isAxiom(sentence)) continue;
      const norm = normalize(sentence);
      if (!norm || seen.has(norm)) continue; // drop in-section duplicates
      seen.add(norm);
      axioms.push({ statement: sentence, hash: sha256(norm) });
      total += 1;
    }

    if (axioms.length === 0) continue;

    const rawLabel = (typeof component.title === 'string' ? component.title : '').trim();
    const label = !rawLabel || normalize(rawLabel) === titleKey ? null : rawLabel;
    sections.push({ label, axioms });
  }

  // contentVersion fingerprints the whole decomposition (labels + normalized
  // axioms, in order) plus the algorithm tag, so any body change or algo bump
  // produces a fresh version and triggers re-materialization.
  const fingerprint = JSON.stringify({
    v: ALGO_VERSION,
    sections: sections.map((s) => ({
      label: s.label,
      axioms: s.axioms.map((a) => a.hash),
    })),
  });

  return {
    contentVersion: sha256(fingerprint),
    sections,
    axiomCount: total,
  };
}
