'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import type { WalkthroughNode } from '@/lib/guides-db';
import styles from './GuideSkillTree.module.css';

interface Props {
  /** Nodes to place, each carrying a computed level + direct prereq ids. */
  nodes: WalkthroughNode[];
  /** Total number of level bands (max level + 1). */
  levels: number;
  /** The summit guide, ringed as "the goal". Omit for a targetless graph (the map). */
  targetId?: string;
  /** Guide ids the viewer has completed (client-tracked, kept in sync by parent). */
  completed: Set<string>;
  /** Slug currently being viewed, so we can mark the "you are here" node. */
  currentSlug?: string;
}

type NodeState = 'completed' | 'available' | 'locked';

interface Placed {
  node: WalkthroughNode;
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
}: Props) {
  const router = useRouter();
  const { play } = useSound();
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);

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
              const cls = [
                styles.node,
                styles[`node_${p.state}`],
                p.isTarget ? styles.nodeTarget : '',
                isHere ? styles.nodeHere : '',
              ]
                .filter(Boolean)
                .join(' ');
              const cx = p.x + NODE_W / 2;
              const cy = p.y + NODE_H / 2;
              const label =
                p.node.topicTitle.length > 26
                  ? `${p.node.topicTitle.slice(0, 25)}…`
                  : p.node.topicTitle;
              return (
                <g
                  key={p.node.id}
                  className={cls}
                  transform={`translate(${p.x} ${p.y})`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${p.node.topicTitle} — ${p.state}`}
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
  );
}
