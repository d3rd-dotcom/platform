'use client';

import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import type { WalkthroughNode } from '@/lib/guides-db';
import { getWellbeingDomain } from '@/lib/wellbeing-domains';
import styles from './GuideSkillTree.module.css';

/** A node with optional subject tags — KnowledgeMapNode satisfies this; a plain
 * WalkthroughNode (no subjects) still satisfies it since the field is optional. */
type ClusterableNode = WalkthroughNode & { subjects?: string[] };

interface Props {
  /** Nodes to place, each carrying a computed level + direct prereq ids. */
  nodes: ClusterableNode[];
  /** Total number of level bands (max level + 1). */
  levels: number;
  /** The summit guide, ringed as "the goal". Omit for a targetless graph (the map). */
  targetId?: string;
  /** Guide ids the viewer has completed (client-tracked, kept in sync by parent). */
  completed: Set<string>;
  /** Slug currently being viewed, so we can mark the "you are here" node. */
  currentSlug?: string;
  /**
   * Opt-in subject-cluster overlay: a per-subject accent dot on each node plus
   * a legend that filters by subject. Off by default so existing callers (the
   * walkthrough view) render exactly as before. Level bands stay authoritative
   * — this never rearranges layout, only tints/dims what's already placed.
   */
  clusterBySubject?: boolean;
}

// A small, deterministic hue palette (oklch), picked from a subject's name so
// the same subject always gets the same accent without a lookup table.
const SUBJECT_HUES = [255, 205, 150, 320, 30, 95, 0, 170, 60, 280];

function hueForSubject(subject: string): number {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_HUES[hash % SUBJECT_HUES.length];
}

type NodeState = 'completed' | 'available' | 'locked';

interface Placed {
  node: ClusterableNode;
  /** Column index within its level band. */
  col: number;
  /** Count of nodes in its level band. */
  cols: number;
  x: number;
  y: number;
  state: NodeState;
  isTarget: boolean;
}

// ── Layout constants (SVG user units) ────────────────────────────────────────
const NODE_W = 168;
const NODE_H = 56;
const COL_GAP = 40; // horizontal gap between node boxes in a band
const BAND_H = 132; // vertical distance between level bands
const PAD_X = 40;
const PAD_TOP = 44;
const PAD_BOTTOM = 44;

export default function GuideSkillTree({
  nodes: inputNodes,
  levels: totalLevels,
  targetId,
  completed,
  currentSlug,
  clusterBySubject = false,
}: Props) {
  const router = useRouter();
  const { play } = useSound();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  // Legend entries: every distinct subject across the graph, each with a
  // deterministic accent hue and (when we have one) its wellbeing domain.
  // Only meaningful when clusterBySubject is on; cheap to compute either way.
  const subjectLegend = useMemo(() => {
    if (!clusterBySubject) return [];
    const seen = new Set<string>();
    for (const n of inputNodes) {
      for (const s of n.subjects ?? []) seen.add(s);
    }
    return Array.from(seen)
      .sort((a, b) => a.localeCompare(b))
      .map((subject) => ({
        subject,
        hue: hueForSubject(subject),
        domain: getWellbeingDomain(subject),
      }));
  }, [inputNodes, clusterBySubject]);

  // Group nodes by level, sorted ascending (0 = primitives).
  const bands = useMemo(() => {
    const map = new Map<number, WalkthroughNode[]>();
    for (const n of inputNodes) {
      const list = map.get(n.level);
      if (list) list.push(n);
      else map.set(n.level, [n]);
    }
    // Stable ordering inside a band: by title.
    for (const list of map.values()) {
      list.sort((a, b) => a.topicTitle.localeCompare(b.topicTitle));
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [inputNodes]);

  // A node is available when every DIRECT prereq is completed; completed wins;
  // otherwise locked. (Mirrors the server-side gate, applied per-node.)
  const stateOf = useCallback(
    (node: WalkthroughNode): NodeState => {
      if (completed.has(node.id)) return 'completed';
      const gated = node.prereqIds.some((pid) => !completed.has(pid));
      return gated ? 'locked' : 'available';
    },
    [completed],
  );

  // ── Layout: bottom-up bands, nodes distributed horizontally within each. ──
  const { placed, byId, width, height } = useMemo(() => {
    const widest = bands.reduce((m, [, list]) => Math.max(m, list.length), 1);
    const w = PAD_X * 2 + widest * NODE_W + (widest - 1) * COL_GAP;
    const h = PAD_TOP + PAD_BOTTOM + (totalLevels - 1) * BAND_H + NODE_H;

    const placedList: Placed[] = [];
    for (const [level, list] of bands) {
      const cols = list.length;
      const rowW = cols * NODE_W + (cols - 1) * COL_GAP;
      const startX = (w - rowW) / 2;
      // Level 0 sits at the visual bottom; higher levels rise toward the top.
      const y = PAD_TOP + (totalLevels - 1 - level) * BAND_H;
      list.forEach((node, col) => {
        placedList.push({
          node,
          col,
          cols,
          x: startX + col * (NODE_W + COL_GAP),
          y,
          state: stateOf(node),
          isTarget: node.id === targetId,
        });
      });
    }
    const idMap = new Map<string, Placed>();
    for (const p of placedList) idMap.set(p.node.id, p);
    return { placed: placedList, byId: idMap, width: w, height: h };
  }, [bands, totalLevels, stateOf, targetId]);

  // Edges: from each node down to its direct prereqs (within the closure).
  const edges = useMemo(() => {
    const list: Array<{ id: string; from: Placed; to: Placed; active: boolean }> = [];
    for (const p of placed) {
      for (const pid of p.node.prereqIds) {
        const prereq = byId.get(pid);
        if (!prereq) continue;
        list.push({
          id: `${p.node.id}->${pid}`,
          from: p,
          to: prereq,
          // Highlight an edge when either endpoint is hovered, or the prereq is done.
          active:
            hoverId === p.node.id ||
            hoverId === pid ||
            (prereq.state === 'completed' && p.state !== 'locked'),
        });
      }
    }
    return list;
  }, [placed, byId, hoverId]);

  const currentLevel = useMemo(() => {
    for (const [level, list] of bands) {
      if (!list.every((n) => completed.has(n.id))) return level;
    }
    return totalLevels > 0 ? totalLevels - 1 : 0;
  }, [bands, completed, totalLevels]);

  const handleActivate = useCallback(
    (p: Placed) => {
      if (p.state === 'available') {
        play('navigation');
        router.push(`/courses/guides/${p.node.slug}`);
      } else if (p.state === 'completed') {
        // Completed nodes are revisitable — soft feedback, still navigate.
        play('soft-hover');
        router.push(`/courses/guides/${p.node.slug}`);
      } else {
        // Locked — reject with error feedback.
        play('error');
      }
    },
    [play, router],
  );

  const handleHover = useCallback(
    (p: Placed) => {
      setHoverId(p.node.id);
      if (p.state === 'locked') return;
      play('soft-hover');
    },
    [play],
  );

  // Curved edge path from the top of a node to the bottom of its prereq.
  const edgePath = (from: Placed, to: Placed) => {
    const x1 = from.x + NODE_W / 2;
    const y1 = from.y; // top edge of the dependent node
    const x2 = to.x + NODE_W / 2;
    const y2 = to.y + NODE_H; // bottom edge of the prereq
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  };

  return (
    <div className={styles.outer}>
    <div className={styles.wrapper}>
      {/* ── Progress rail ─────────────────────────────────────────────── */}
      <aside className={styles.rail} aria-hidden="true">
        <span className={styles.railLabel}>
          Level {Math.min(currentLevel + 1, totalLevels)} of {totalLevels}
        </span>
        <div className={styles.railTicks}>
          {Array.from({ length: totalLevels }).map((_, i) => {
            // Rail is bottom-up too: last tick = target level.
            const level = totalLevels - 1 - i;
            const bandNodes = bands.find(([l]) => l === level)?.[1] ?? [];
            const bandDone =
              bandNodes.length > 0 && bandNodes.every((n) => completed.has(n.id));
            const isCurrent = level === currentLevel;
            return (
              <span
                key={level}
                className={`${styles.tick} ${bandDone ? styles.tickDone : ''} ${
                  isCurrent ? styles.tickCurrent : ''
                }`}
              >
                <span className={styles.tickNum}>{level + 1}</span>
              </span>
            );
          })}
        </div>
      </aside>

      {/* ── Constellation ─────────────────────────────────────────────── */}
      <div className={styles.canvas}>
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="group"
          aria-label="Guide prerequisite skill tree"
        >
          <defs>
            <linearGradient id="mwa-edge" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.55" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* Edges under nodes */}
          <g className={styles.edges}>
            {edges.map((e) => (
              <path
                key={e.id}
                d={edgePath(e.from, e.to)}
                className={`${styles.edge} ${e.active ? styles.edgeActive : ''}`}
                fill="none"
              />
            ))}
          </g>

          {/* Nodes */}
          <g>
            {placed.map((p) => {
              const isHere = p.node.slug === currentSlug;
              const primarySubject = clusterBySubject ? p.node.subjects?.[0] : undefined;
              const nodeSubjects = clusterBySubject ? p.node.subjects ?? [] : [];
              const isDimmed =
                clusterBySubject &&
                selectedSubject !== null &&
                !nodeSubjects.includes(selectedSubject);
              const cls = [
                styles.node,
                styles[`node_${p.state}`],
                p.isTarget ? styles.nodeTarget : '',
                isHere ? styles.nodeHere : '',
                isDimmed ? styles.nodeDimmed : '',
              ]
                .filter(Boolean)
                .join(' ');
              const label =
                p.node.topicTitle.length > 26
                  ? `${p.node.topicTitle.slice(0, 25)}…`
                  : p.node.topicTitle;
              const accentStyle = primarySubject
                ? ({ '--subject-hue': hueForSubject(primarySubject) } as CSSProperties)
                : undefined;
              return (
                <g
                  key={p.node.id}
                  className={cls}
                  transform={`translate(${p.x} ${p.y})`}
                  style={accentStyle}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.node.topicTitle} — ${p.state}${
                    primarySubject ? `, subject: ${primarySubject}` : ''
                  }`}
                  onMouseEnter={() => handleHover(p)}
                  onMouseLeave={() => setHoverId(null)}
                  onClick={() => handleActivate(p)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' || ev.key === ' ') {
                      ev.preventDefault();
                      handleActivate(p);
                    }
                  }}
                >
                  {/* Target ring */}
                  {p.isTarget && (
                    <rect
                      className={styles.targetRing}
                      x={-6}
                      y={-6}
                      width={NODE_W + 12}
                      height={NODE_H + 12}
                      rx={16}
                    />
                  )}
                  <rect
                    className={styles.nodeBox}
                    width={NODE_W}
                    height={NODE_H}
                    rx={12}
                  />
                  {primarySubject && (
                    <rect
                      className={styles.subjectAccent}
                      x={0}
                      y={0}
                      width={4}
                      height={NODE_H}
                      rx={2}
                    />
                  )}
                  {p.state === 'locked' && (
                    <g
                      className={styles.lockMark}
                      transform={`translate(${NODE_W - 24} 11)`}
                    >
                      {/* Inline padlock — avoids nested <svg> positioning quirks. */}
                      <rect x={2} y={6} width={10} height={7} rx={1.5} />
                      <path
                        d="M4 6 V4.2 A3 3 0 0 1 10 4.2 V6"
                        fill="none"
                        strokeWidth={1.6}
                      />
                    </g>
                  )}
                  <text
                    className={styles.nodeLabel}
                    x={NODE_W / 2}
                    y={NODE_H / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {label}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
    </div>

      {/* ── Subject legend / filter (opt-in overlay, layout untouched) ────── */}
      {clusterBySubject && subjectLegend.length > 0 && (
        <div className={styles.legend} role="group" aria-label="Filter by subject">
          {subjectLegend.map(({ subject, hue, domain }) => {
            const isSelected = selectedSubject === subject;
            return (
              <button
                key={subject}
                type="button"
                className={`${styles.legendItem} ${isSelected ? styles.legendItemSelected : ''}`}
                style={{ '--subject-hue': hue } as CSSProperties}
                title={domain ? domain.blurb : undefined}
                aria-pressed={isSelected}
                onClick={() => {
                  play('soft-hover');
                  setSelectedSubject((prev) => (prev === subject ? null : subject));
                }}
              >
                <span className={styles.legendDot} aria-hidden="true" />
                <span className={styles.legendLabel}>{subject}</span>
                {domain && <span className={styles.legendDomain}>{domain.label}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
