'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { ArrowsInSimple, Minus, Plus } from '@phosphor-icons/react';
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
const NODE_W = 252;
const NODE_H = 78;
const COL_GAP = 18;
const BAND_H = 118;
const PAD_X = 44;
const PAD_TOP = 48;
const PAD_BOTTOM = 48;
const MIN_ZOOM = 0.55;
const MAX_ZOOM = 1.25;
const DEFAULT_MAP_ZOOM = 0.78;

function titleLines(title: string): string[] {
  const maxChars = 22;
  const words = title.split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= maxChars || line.length === 0) {
      line = candidate;
      continue;
    }
    lines.push(line);
    line = word;
    if (lines.length === 1) break;
  }

  if (lines.length < 2 && line) lines.push(line);
  lines.forEach((value, index) => {
    if (value.length > maxChars) lines[index] = `${value.slice(0, maxChars - 1)}…`;
  });
  const consumed = lines.join(' ').length;
  if (consumed < title.length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, maxChars - 1).trim()}…`;
  }
  return lines.slice(0, 2);
}

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
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const mapInitializedRef = useRef(false);
  const previousSubjectRef = useRef<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [zoom, setZoom] = useState(clusterBySubject ? DEFAULT_MAP_ZOOM : 1);
  const [isPanning, setIsPanning] = useState(false);

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

  const layoutNodes = useMemo(() => {
    if (!selectedSubject) return inputNodes;

    const byId = new Map(inputNodes.map((node) => [node.id, node]));
    const included = new Set(
      inputNodes
        .filter((node) => node.subjects?.includes(selectedSubject))
        .map((node) => node.id),
    );
    const queue = Array.from(included);
    while (queue.length > 0) {
      const id = queue.pop()!;
      for (const prereqId of byId.get(id)?.prereqIds ?? []) {
        if (included.has(prereqId)) continue;
        included.add(prereqId);
        queue.push(prereqId);
      }
    }
    return inputNodes.filter((node) => included.has(node.id));
  }, [inputNodes, selectedSubject]);

  // Group nodes by level. Higher bands follow the horizontal order of their
  // prerequisites, which keeps branches closer and cuts down edge crossings.
  const bands = useMemo(() => {
    const map = new Map<number, ClusterableNode[]>();
    for (const n of layoutNodes) {
      const list = map.get(n.level);
      if (list) list.push(n);
      else map.set(n.level, [n]);
    }

    const order = new Map<string, number>();
    const sortedLevels = Array.from(map.keys()).sort((a, b) => a - b);
    for (const level of sortedLevels) {
      const list = map.get(level)!;
      list.sort((a, b) => {
        const aParents = a.prereqIds.map((id) => order.get(id)).filter((n): n is number => n !== undefined);
        const bParents = b.prereqIds.map((id) => order.get(id)).filter((n): n is number => n !== undefined);
        const aCenter = aParents.length > 0 ? aParents.reduce((sum, n) => sum + n, 0) / aParents.length : null;
        const bCenter = bParents.length > 0 ? bParents.reduce((sum, n) => sum + n, 0) / bParents.length : null;
        if (aCenter !== null && bCenter !== null && aCenter !== bCenter) return aCenter - bCenter;
        if (aCenter !== null && bCenter === null) return -1;
        if (aCenter === null && bCenter !== null) return 1;
        return a.topicTitle.localeCompare(b.topicTitle);
      });
      list.forEach((node, index) => order.set(node.id, index));
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [layoutNodes]);

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

  const depthProgress = useMemo(() => {
    const visibleNodes = selectedSubject
      ? inputNodes.filter((node) => node.subjects?.includes(selectedSubject))
      : inputNodes;
    const stats = Array.from({ length: totalLevels }, (_, level) => {
      const nodes = visibleNodes.filter((node) => node.level === level);
      return {
        level,
        total: nodes.length,
        completed: nodes.filter((node) => completed.has(node.id)).length,
        available: nodes.filter((node) => stateOf(node) === 'available').length,
      };
    }).filter((stat) => stat.total > 0);
    const completedNodes = visibleNodes.filter((node) => completed.has(node.id));
    const deepestCompleted =
      completedNodes.length > 0
        ? Math.max(...completedNodes.map((node) => node.level))
        : null;
    const available = visibleNodes.filter((node) => stateOf(node) === 'available').length;
    return { stats, deepestCompleted, available };
  }, [completed, inputNodes, selectedSubject, stateOf, totalLevels]);

  const handleActivate = useCallback(
    (p: Placed) => {
      if (p.state === 'available') {
        play('navigation');
        router.push(`/home/guides/${p.node.slug}`);
      } else if (p.state === 'completed') {
        // Completed nodes are revisitable — soft feedback, still navigate.
        play('soft-hover');
        router.push(`/home/guides/${p.node.slug}`);
      } else {
        // Locked guides remain inspectable so the learner can understand the
        // goal; the server-side completion gate still enforces prerequisites.
        play('navigation');
        router.push(`/home/guides/${p.node.slug}`);
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

  const centerOnLevel = useCallback(
    (level: number, behavior: ScrollBehavior = 'smooth') => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const y = PAD_TOP + (totalLevels - 1 - level) * BAND_H + NODE_H / 2;
      canvas.scrollTo({
        left: Math.max(0, (width * zoom - canvas.clientWidth) / 2),
        top: Math.max(0, y * zoom - canvas.clientHeight / 2),
        behavior,
      });
    },
    [totalLevels, width, zoom],
  );

  const changeZoom = useCallback(
    (nextZoom: number) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const canvas = canvasRef.current;
      if (!canvas) {
        setZoom(next);
        return;
      }
      const centerX = (canvas.scrollLeft + canvas.clientWidth / 2) / zoom;
      const centerY = (canvas.scrollTop + canvas.clientHeight / 2) / zoom;
      setZoom(next);
      requestAnimationFrame(() => {
        canvas.scrollLeft = Math.max(0, centerX * next - canvas.clientWidth / 2);
        canvas.scrollTop = Math.max(0, centerY * next - canvas.clientHeight / 2);
      });
    },
    [zoom],
  );

  const resetMapView = useCallback(() => {
    setZoom(DEFAULT_MAP_ZOOM);
    requestAnimationFrame(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const startY = PAD_TOP + (totalLevels - 1) * BAND_H + NODE_H / 2;
      canvas.scrollTo({
        left: Math.max(0, (width * DEFAULT_MAP_ZOOM - canvas.clientWidth) / 2),
        top: Math.max(0, startY * DEFAULT_MAP_ZOOM - canvas.clientHeight / 2),
        behavior: 'smooth',
      });
    });
  }, [totalLevels, width]);

  useEffect(() => {
    if (!clusterBySubject || mapInitializedRef.current) return;
    mapInitializedRef.current = true;
    const frame = requestAnimationFrame(() => centerOnLevel(0, 'auto'));
    return () => cancelAnimationFrame(frame);
  }, [centerOnLevel, clusterBySubject]);

  useEffect(() => {
    if (!clusterBySubject || previousSubjectRef.current === selectedSubject) return;
    previousSubjectRef.current = selectedSubject;
    const frame = requestAnimationFrame(() => centerOnLevel(0));
    return () => cancelAnimationFrame(frame);
  }, [centerOnLevel, clusterBySubject, selectedSubject]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('[role="button"]')) return;
    const canvas = event.currentTarget;
    dragRef.current = {
      x: event.clientX,
      y: event.clientY,
      left: canvas.scrollLeft,
      top: canvas.scrollTop,
    };
    setIsPanning(true);
    canvas.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    event.currentTarget.scrollLeft = drag.left - (event.clientX - drag.x);
    event.currentTarget.scrollTop = drag.top - (event.clientY - drag.y);
  }, []);

  const stopPanning = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

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
    <div className={`${styles.outer} ${clusterBySubject ? styles.mapMode : ''}`}>
    <div className={styles.wrapper}>
      {/* ── Branch-aware progress ─────────────────────────────────────── */}
      <aside className={styles.rail} aria-label="Knowledge depth progress">
        <div className={styles.railHeader}>
          <span className={styles.railLabel}>
            {selectedSubject ?? 'All subjects'}
          </span>
          <span className={styles.railMilestone}>
            {depthProgress.deepestCompleted === null
              ? 'First clear ready'
              : `Depth ${depthProgress.deepestCompleted + 1} reached`}
          </span>
          <span className={styles.railReady}>
            {depthProgress.available} ready now
          </span>
        </div>
        <div className={styles.railTicks}>
          {[...depthProgress.stats].reverse().map((stat) => {
            const bandDone = stat.completed === stat.total;
            const isCurrent = stat.available > 0;
            return (
              <button
                type="button"
                key={stat.level}
                className={`${styles.tick} ${bandDone ? styles.tickDone : ''} ${
                  isCurrent ? styles.tickCurrent : ''
                }`}
                title={`Depth ${stat.level + 1}: ${stat.completed} of ${stat.total} cleared`}
                onClick={() => centerOnLevel(stat.level)}
              >
                <span className={styles.tickRow}>
                  <span className={styles.tickNum}>Depth {stat.level + 1}</span>
                  <span className={styles.tickCount}>{stat.completed}/{stat.total}</span>
                </span>
                <span className={styles.tickTrack} aria-hidden="true">
                  <span
                    className={styles.tickFill}
                    style={{ width: `${(stat.completed / stat.total) * 100}%` }}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </aside>

      {/* ── Constellation ─────────────────────────────────────────────── */}
      <div className={styles.canvasShell}>
        {clusterBySubject && (
          <div className={styles.canvasToolbar} aria-label="Map view controls">
            <span className={styles.canvasHint}>Drag to move</span>
            <button
              type="button"
              className={styles.viewButton}
              onClick={() => changeZoom(zoom - 0.12)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="Zoom out"
            >
              <Minus size={15} weight="bold" />
            </button>
            <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className={styles.viewButton}
              onClick={() => changeZoom(zoom + 0.12)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="Zoom in"
            >
              <Plus size={15} weight="bold" />
            </button>
            <button
              type="button"
              className={`${styles.viewButton} ${styles.startButton}`}
              onClick={resetMapView}
            >
              <ArrowsInSimple size={15} weight="bold" /> Start
            </button>
          </div>
        )}
      <div
        ref={canvasRef}
        className={`${styles.canvas} ${clusterBySubject ? styles.canvasInteractive : ''} ${isPanning ? styles.canvasPanning : ''}`}
        onPointerDown={clusterBySubject ? handlePointerDown : undefined}
        onPointerMove={clusterBySubject ? handlePointerMove : undefined}
        onPointerUp={clusterBySubject ? stopPanning : undefined}
        onPointerCancel={clusterBySubject ? stopPanning : undefined}
      >
        <svg
          ref={svgRef}
          className={styles.svg}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={clusterBySubject ? { width: width * zoom, height: height * zoom } : undefined}
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
              const lines = titleLines(p.node.topicTitle);
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
                    rx={14}
                  />
                  <rect
                    className={styles.subjectAccent}
                    x={14}
                    y={25}
                    width={3}
                    height={28}
                    rx={2}
                  />
                  <rect className={styles.nodeArtwork} x={28} y={19} width={40} height={40} rx={8} />
                  <circle className={styles.nodeArtworkOrb} cx={55} cy={31} r={9} />
                  <path className={styles.nodeArtworkLine} d="M 34 52 C 43 42, 51 55, 63 38" />
                  {p.state === 'locked' && (
                    <g
                      className={styles.lockMark}
                      transform={`translate(${NODE_W - 35} 27)`}
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
                  {p.state === 'completed' && (
                    <g className={styles.completeMark} transform={`translate(${NODE_W - 37} 25)`}>
                      <circle cx={10} cy={10} r={10} />
                      <path d="M5.5 10.5 8.5 13.5 14.8 6.8" />
                    </g>
                  )}
                  {p.state === 'available' && (
                    <circle className={styles.availableMark} cx={NODE_W - 27} cy={39} r={10} />
                  )}
                  <text className={styles.nodeLabel}>
                    {lines.map((line, index) => (
                      <tspan key={line} x={80} y={lines.length === 1 ? 35 : 28 + index * 16}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                  <text className={styles.nodeStateLabel} x={80} y={lines.length === 1 ? 56 : 62}>
                    {p.state === 'completed' ? 'Cleared' : p.state === 'available' ? 'Ready now' : 'Requires prerequisites'}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>
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
