'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData, GraphEdge, GraphNode } from '@/lib/simulation-api';
import styles from './simulation.module.css';

/**
 * Directed labeled knowledge-graph viewer. The backend can return either the
 * frontend-normalized edge-list shape (`source` / `target`) or Zep's native
 * shape (`source_node_uuid` / `target_node_uuid`), so this component first
 * normalizes graph data and then runs a small force-directed layout locally.
 */

interface SimNode {
  id: string;
  label: string;
  type: string;
  r: number;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  raw: GraphNode;
}

interface SimLink {
  id: string;
  source: string;
  target: string;
  label: string;
  fact?: string;
  isExpired: boolean;
  pairOffset: number;
  pairTotal: number;
  raw: GraphEdge;
}

type GraphSelection =
  | { kind: 'node'; id: string }
  | { kind: 'edge'; id: string }
  | null;

const W = 1120;
const H = 760;
const MAX_NODES = 160;
const MAX_EDGE_LABELS = 80;

const TYPE_COLORS = ['#5168FF', '#9724A6', '#1FAA8C', '#E0701A', '#C73E6B', '#3B82F6', '#8B5CF6'];
const META_NODE_PATTERNS = [
  'additional relationship types',
  'relationship type',
  'relationship types',
  'edge type',
  'edge types',
  'additional entity types',
  'entity type',
  'entity types',
  'ontology',
  'schema',
  'metadata',
];

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

function initialViewFor(count: number) {
  const k = count > 90 ? 0.9 : count > 55 ? 0.98 : count > 24 ? 1.06 : 1.16;
  return {
    x: W / (2 * k) - W / 2,
    y: H / (2 * k) - H / 2,
    k,
  };
}

function nodeId(n: GraphNode) {
  return str(n.id) || str(n.uuid) || str(n.attributes?.id) || str(n.name) || str(n.label);
}

function nodeLabel(n: GraphNode, id: string) {
  return str(n.name) || str(n.label) || str(n.attributes?.name) || id;
}

function nodeType(n: GraphNode) {
  return str(n.type) || str(n.labels?.[0]) || str(n.attributes?.type) || 'Entity';
}

function isMetaNode(n: GraphNode) {
  const labels = (n.labels || [])
    .map((label) => str(label).toLowerCase())
    .filter(Boolean);
  const customLabels = labels.filter((label) => label !== 'entity' && label !== 'node');
  if (!labels.length || !customLabels.length) return true;
  if (customLabels.some((label) => label === 'uuid' || label === 'id')) return true;

  const haystack = [str(n.name).toLowerCase(), ...customLabels].join(' ');
  return META_NODE_PATTERNS.some((pattern) => haystack.includes(pattern));
}

function edgeSource(e: GraphEdge) {
  return str(e.source) || str(e.source_node_uuid) || str(e.from) || str(e.source_node_name);
}

function edgeTarget(e: GraphEdge) {
  return str(e.target) || str(e.target_node_uuid) || str(e.to) || str(e.target_node_name);
}

function edgeLabel(e: GraphEdge) {
  return str(e.type) || str(e.name) || str(e.fact_type) || str(e.attributes?.edge_type) || 'RELATES_TO';
}

function edgeFact(e: GraphEdge) {
  return str(e.fact) || str(e.attributes?.fact);
}

function isExpiredEdge(e: GraphEdge) {
  return Boolean(str(e.expired_at) || str(e.invalid_at));
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1)}…` : value;
}

function detailValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(detailValue).filter(Boolean).join(', ');
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function detailEntries(record: Record<string, unknown> | undefined, limit = 14) {
  if (!record) return [];
  return Object.entries(record)
    .map(([key, value]) => ({ key, value: detailValue(value) }))
    .filter((item) => item.value)
    .slice(0, limit);
}

function detailList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(detailValue).filter(Boolean);
}

function dateValue(value: unknown) {
  const raw = detailValue(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function titleCase(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word ? word.slice(0, 1).toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(' ');
}

function edgePath(a: SimNode, b: SimNode, offset: number, pairTotal: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (a === b || (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)) {
    const loop = a.r + 36 + Math.abs(offset) * 0.8;
    const sx = a.x + a.r * 0.78;
    const sy = a.y - a.r * 0.42;
    const tx = a.x + a.r * 0.78;
    const ty = a.y + a.r * 0.42;
    return {
      d: `M ${sx} ${sy} A ${loop} ${loop} 0 1 1 ${tx} ${ty}`,
      labelX: a.x + loop + 18,
      labelY: a.y,
      angle: 0,
    };
  }
  const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;
  const sx = a.x + ux * (a.r + 4);
  const sy = a.y + uy * (a.r + 4);
  const tx = b.x - ux * (b.r + 11);
  const ty = b.y - uy * (b.r + 11);

  if (Math.abs(offset) < 0.01) {
    return {
      d: `M ${sx} ${sy} L ${tx} ${ty}`,
      labelX: (sx + tx) / 2,
      labelY: (sy + ty) / 2,
      angle: 0,
    };
  }

  const curve = Math.max(34, Math.min(120, Math.abs(offset) * (1.5 + pairTotal * 0.08)));
  const signedCurve = offset < 0 ? -curve : curve;
  const cx = (sx + tx) / 2 + nx * signedCurve;
  const cy = (sy + ty) / 2 + ny * signedCurve;
  return {
    d: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`,
    labelX: 0.25 * sx + 0.5 * cx + 0.25 * tx,
    labelY: 0.25 * sy + 0.5 * cy + 0.25 * ty,
    angle: 0,
  };
}

export default function GraphPanel({ graph, worldName }: { graph: GraphData | null; worldName?: string }) {
  const [, force] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [selected, setSelected] = useState<GraphSelection>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rafRef = useRef<number>();
  const dragRef = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null);
  const nodeDragRef = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // Wheel zoom must be non-passive because we intentionally block page
    // scrolling while the cursor is over the graph canvas.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = Math.max(-120, Math.min(120, e.deltaY));
      setView((current) => ({
        ...current,
        k: Math.max(0.45, Math.min(3.2, current.k * Math.exp(-delta * 0.00045))),
      }));
    };

    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', onWheel);
    };
  }, []);

  const { nodes, links, types, colorOf } = useMemo(() => {
    if (!graph?.nodes?.length) {
      return { nodes: [] as SimNode[], links: [] as SimLink[], types: [] as string[], colorOf: () => '#5168FF' };
    }

    const rawNodes = graph.nodes
      .map((n) => ({ raw: n, id: nodeId(n) }))
      .filter((n) => n.id && !isMetaNode(n.raw))
      .slice(0, MAX_NODES);
    const ids = new Set(rawNodes.map((n) => n.id));

    const normalizedLinks: SimLink[] = (graph.edges || [])
      .map((e, i) => {
        const source = edgeSource(e);
        const target = edgeTarget(e);
        return {
          id: str(e.id) || str(e.uuid) || `${source}-${target}-${i}`,
          source,
          target,
          label: edgeLabel(e),
          fact: edgeFact(e),
          isExpired: isExpiredEdge(e),
          pairOffset: 0,
          pairTotal: 1,
          raw: e,
        };
      })
      .filter((e) => ids.has(e.source) && ids.has(e.target));

    const degree = new Map<string, number>();
    for (const l of normalizedLinks) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1);
      degree.set(l.target, (degree.get(l.target) || 0) + 1);
    }

    const pairCounts = new Map<string, number>();
    const pairSeen = new Map<string, number>();
    for (const l of normalizedLinks) {
      const key = l.source === l.target ? `self:${l.source}` : [l.source, l.target].sort().join('~');
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
    for (const l of normalizedLinks) {
      const key = l.source === l.target ? `self:${l.source}` : [l.source, l.target].sort().join('~');
      const seen = pairSeen.get(key) || 0;
      const total = pairCounts.get(key) || 1;
      pairSeen.set(key, seen + 1);
      l.pairTotal = total;
      l.pairOffset = (seen - (total - 1) / 2) * Math.min(30, 18 + total * 1.8);
    }

    const types = Array.from(new Set(rawNodes.map(({ raw }) => nodeType(raw))));
    const colorOf = (t: string) => TYPE_COLORS[Math.max(0, types.indexOf(t)) % TYPE_COLORS.length];

    const nodes: SimNode[] = rawNodes.map(({ raw, id }, i) => {
      const deg = degree.get(id) || 0;
      const angle = (i / rawNodes.length) * Math.PI * 2;
      const orbit = 160 + Math.min(170, rawNodes.length * 3.8);
      return {
        id,
        label: nodeLabel(raw, id),
        type: nodeType(raw),
        degree: deg,
        r: 9 + Math.min(13, Math.sqrt(Math.max(1, deg)) * 3.1),
        x: W / 2 + Math.cos(angle) * orbit,
        y: H / 2 + Math.sin(angle) * orbit,
        vx: 0,
        vy: 0,
        raw,
      };
    });

    return { nodes, links: normalizedLinks, types, colorOf };
  }, [graph]);

  useEffect(() => {
    nodesRef.current = nodes;
    setView(initialViewFor(nodes.length));
    setSelected(null);
    if (!nodes.length) return;

    const byId = new Map(nodes.map((n) => [n.id, n]));
    let ticks = 0;

    const step = () => {
      const ns = nodesRef.current;
      const draggedNodeId = nodeDragRef.current?.id;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const f = 7600 / d2;
          let fx = (dx / d) * f;
          let fy = (dy / d) * f;
          const minD = a.r + b.r + 46;
          if (d < minD) {
            const push = (minD - d) * 0.7;
            fx += (dx / d) * push;
            fy += (dy / d) * push;
          }
          a.vx += fx;
          a.vy += fy;
          b.vx -= fx;
          b.vy -= fy;
        }
      }

      for (const l of links) {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (!a || !b || a === b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const targetDistance = 185 + Math.min(115, (l.pairTotal - 1) * 36 + Math.abs(l.pairOffset));
        const f = (d - targetDistance) * 0.013;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const n of ns) {
        if (n.id === draggedNodeId) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx += (W / 2 - n.x) * 0.0028;
        n.vy += (H / 2 - n.y) * 0.0028;
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x += n.vx;
        n.y += n.vy;
        const m = n.r + 22;
        n.x = Math.max(m, Math.min(W - m, n.x));
        n.y = Math.max(m, Math.min(H - m, n.y));
      }

      ticks++;
      force((c) => c + 1);
      if (ticks < 360) rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [nodes, links]);

  if (!graph?.nodes?.length) {
    return (
      <div className={styles.graphEmpty}>
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" aria-hidden>
          <circle cx="14" cy="16" r="4" fill="#5168FF" opacity="0.5" />
          <circle cx="34" cy="13" r="3" fill="#9724A6" opacity="0.5" />
          <circle cx="30" cy="34" r="5" fill="#1FAA8C" opacity="0.5" />
          <path d="M18 16 C23 12 28 12 31 13" stroke="#5168FF" strokeWidth="1.4" opacity="0.45" markerEnd="url(#emptyArrow)" />
          <path d="M17 19 C21 26 24 31 27 33" stroke="#5168FF" strokeWidth="1.4" opacity="0.45" markerEnd="url(#emptyArrow)" />
          <defs>
            <marker id="emptyArrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto">
              <path d="M0 0 L8 4 L0 8 Z" fill="#5168FF" opacity="0.55" />
            </marker>
          </defs>
        </svg>
        <p>No graph yet</p>
        <span>The directed knowledge graph appears here once it is built.</span>
      </div>
    );
  }

  const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
  const showAllNodeLabels = nodesRef.current.length <= 50;
  const labeledLinks = links.slice(0, MAX_EDGE_LABELS);
  const selectedNodeId = selected?.kind === 'node' ? selected.id : '';
  const selectedEdgeId = selected?.kind === 'edge' ? selected.id : '';
  const selectedNode = selectedNodeId ? byId.get(selectedNodeId) : null;
  const selectedEdge = selectedEdgeId ? links.find((l) => l.id === selectedEdgeId) : null;
  const selectedEdgeSource = selectedEdge ? byId.get(selectedEdge.source) : null;
  const selectedEdgeTarget = selectedEdge ? byId.get(selectedEdge.target) : null;
  const ontologyTitle = `${titleCase(worldName || 'Knowledge Graph')} Ontology`;
  const selectedNodeRaw = selectedNode?.raw;
  const selectedNodeUuid = detailValue(selectedNodeRaw?.uuid) || selectedNode?.id || '';
  const selectedNodeCreated = dateValue(selectedNodeRaw?.created_at);
  const selectedNodeLabels = selectedNodeRaw?.labels?.filter(Boolean) ?? [];
  const selectedNodeProperties = detailEntries(selectedNodeRaw?.attributes);
  const selectedEdgeRaw = selectedEdge?.raw;
  const selectedEdgeUuid = detailValue(selectedEdgeRaw?.uuid) || selectedEdge?.id || '';
  const selectedEdgeCreated = dateValue(selectedEdgeRaw?.created_at);
  const selectedEdgeValidAt = dateValue(selectedEdgeRaw?.valid_at);
  const selectedEdgeExpiredAt = dateValue(selectedEdgeRaw?.expired_at || selectedEdgeRaw?.invalid_at);
  const selectedEdgeEpisodes = detailList(selectedEdgeRaw?.episodes || selectedEdgeRaw?.attributes?.episodes);
  const selectedEdgeProperties = detailEntries(selectedEdgeRaw?.attributes);

  const zoom = (next: number) => setView((v) => ({ ...v, k: Math.max(0.45, Math.min(3.2, next)) }));
  const clientToGraphPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const svgX = ((clientX - rect.left) / rect.width) * W;
    const svgY = ((clientY - rect.top) / rect.height) * H;
    return {
      x: (svgX - view.x) / view.k,
      y: (svgY - view.y) / view.k,
    };
  };

  return (
    <div className={styles.graphWrap}>
      <div className={styles.graphPanelHeader}>
        <div>
          <p className={styles.graphPanelEyebrow}>{ontologyTitle}</p>
          <h2 className={styles.graphPanelTitle}>Graph Relationship Visualization</h2>
        </div>
        <div className={styles.graphHeaderTools} aria-label="Graph controls">
          <button type="button" onClick={() => zoom(view.k / 1.08)}>−</button>
          <button type="button" onClick={() => zoom(view.k * 1.08)}>+</button>
          <button type="button" onClick={() => setView(initialViewFor(nodesRef.current.length || nodes.length))}>Reset</button>
        </div>
      </div>

      <label className={styles.graphEdgeToggle}>
        <input
          type="checkbox"
          checked={showEdgeLabels}
          onChange={(e) => setShowEdgeLabels(e.target.checked)}
        />
        <span className={styles.graphToggleTrack} aria-hidden="true" />
        <span>Show Edge Labels</span>
      </label>

      <div className={styles.graphLiveHint}>
        <span className={styles.graphLiveIcon} aria-hidden="true">◌</span>
        Relationship pathing online
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={styles.graphSvg}
        onPointerDown={(e) => {
          if (nodeDragRef.current) return;
          dragRef.current = { x: e.clientX, y: e.clientY, viewX: view.x, viewY: view.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          setView((v) => ({ ...v, x: drag.viewX + (e.clientX - drag.x) / v.k, y: drag.viewY + (e.clientY - drag.y) / v.k }));
        }}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerLeave={() => {
          dragRef.current = null;
        }}
        onClick={() => setSelected(null)}
      >
        <defs>
          <radialGradient id="graphVignette" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="rgba(81,104,255,0.12)" />
            <stop offset="100%" stopColor="rgba(81,104,255,0)" />
          </radialGradient>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <marker id="graphArrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(92,102,132,0.72)" />
          </marker>
          <marker id="graphArrowFaded" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(120,125,150,0.38)" />
          </marker>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#graphVignette)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g className={styles.graphEdgeHits}>
            {links.map((l, i) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const path = edgePath(a, b, l.pairOffset, l.pairTotal);
              return (
                <path
                  key={`hit-${l.id}-${i}`}
                  d={path.d}
                  className={styles.graphEdgeHit}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected({ kind: 'edge', id: l.id });
                  }}
                />
              );
            })}
          </g>

          <g className={styles.graphEdges}>
            {links.map((l, i) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const path = edgePath(a, b, l.pairOffset, l.pairTotal);
              const isActive = selectedEdgeId === l.id || selectedNodeId === l.source || selectedNodeId === l.target;
              const isMuted = Boolean(selected) && !isActive;
              return (
                <path
                  key={`edge-${l.id}-${i}`}
                  d={path.d}
                  className={[
                    l.isExpired ? styles.graphEdgeExpired : styles.graphEdge,
                    isActive ? styles.graphEdgeActive : '',
                    isMuted ? styles.graphEdgeMuted : '',
                  ].filter(Boolean).join(' ')}
                  markerEnd={l.isExpired ? 'url(#graphArrowFaded)' : 'url(#graphArrow)'}
                >
                  {l.fact && <title>{`${a.label} → ${l.label} → ${b.label}\n${l.fact}`}</title>}
                </path>
              );
            })}
          </g>

          {showEdgeLabels && (
            <g className={styles.graphEdgeLabels}>
              {labeledLinks.map((l, i) => {
                const a = byId.get(l.source);
                const b = byId.get(l.target);
                if (!a || !b) return null;
                const path = edgePath(a, b, l.pairOffset, l.pairTotal);
                const label = truncate(l.label, 26);
                const labelWidth = Math.max(42, label.length * 6.6 + 12);
                const isActive = selectedEdgeId === l.id || selectedNodeId === l.source || selectedNodeId === l.target;
                const isMuted = Boolean(selected) && !isActive;
                return (
                  <g
                    key={`label-${l.id}-${i}`}
                    className={isMuted ? styles.graphLabelMuted : ''}
                    transform={`translate(${path.labelX},${path.labelY})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelected({ kind: 'edge', id: l.id });
                    }}
                  >
                    <rect
                      x={-labelWidth / 2}
                      y="-9"
                      width={labelWidth}
                      height="18"
                      rx="5"
                      className={isActive ? styles.graphEdgeLabelActive : ''}
                    />
                    <text textAnchor="middle" dominantBaseline="middle">
                      {label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          <g className={styles.graphNodes}>
            {nodesRef.current.map((n, i) => {
              const c = colorOf(n.type);
              const showLabel = showAllNodeLabels || n.degree >= 2;
              const isActive = selectedNodeId === n.id || Boolean(selectedEdge && (selectedEdge.source === n.id || selectedEdge.target === n.id));
              const isMuted = Boolean(selected) && !isActive;
              return (
                <g
                  key={`${n.id}-${i}`}
                  data-graph-node="true"
                  aria-label={`${n.label} node`}
                  role="button"
                  className={[
                    styles.graphNode,
                    isActive ? styles.graphNodeActive : '',
                    isMuted ? styles.graphNodeMuted : '',
                  ].filter(Boolean).join(' ')}
                  transform={`translate(${n.x},${n.y})`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    dragRef.current = null;
                    nodeDragRef.current = { id: n.id, startX: e.clientX, startY: e.clientY, moved: false };
                    n.vx = 0;
                    n.vy = 0;
                    setSelected({ kind: 'node', id: n.id });
                    e.currentTarget.setPointerCapture(e.pointerId);
                  }}
                  onPointerMove={(e) => {
                    const active = nodeDragRef.current;
                    if (!active || active.id !== n.id) return;
                    e.stopPropagation();
                    const distance = Math.hypot(e.clientX - active.startX, e.clientY - active.startY);
                    if (distance > 3) active.moved = true;
                    const p = clientToGraphPoint(e.clientX, e.clientY);
                    if (!p) return;
                    const m = n.r + 22;
                    n.x = Math.max(m, Math.min(W - m, p.x));
                    n.y = Math.max(m, Math.min(H - m, p.y));
                    n.vx = 0;
                    n.vy = 0;
                    force((c) => c + 1);
                  }}
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (nodeDragRef.current?.id === n.id) {
                      nodeDragRef.current = null;
                    }
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      // Pointer capture may already be released by the browser.
                    }
                    setSelected({ kind: 'node', id: n.id });
                  }}
                  onPointerCancel={() => {
                    if (nodeDragRef.current?.id === n.id) nodeDragRef.current = null;
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelected({ kind: 'node', id: n.id });
                  }}
                >
                  <circle r={n.r + 4} fill={c} opacity={0.18} filter="url(#nodeGlow)" />
                  <circle className={styles.graphNodeBody} r={n.r} fill={c} />
                  <circle cx={-n.r * 0.3} cy={-n.r * 0.34} r={n.r * 0.38} fill="rgba(255,255,255,0.42)" />
                  <text y="3" textAnchor="middle" className={styles.graphNodeInitial}>
                    {n.label.slice(0, 1).toUpperCase()}
                  </text>
                  {showLabel && (
                    <text y={n.r + 14} textAnchor="middle" className={styles.graphNodeLabel}>
                      {truncate(n.label, 24)}
                    </text>
                  )}
                  <title>{`${n.label}\nType: ${n.type}\nDegree: ${n.degree}`}</title>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {types.length > 0 && (
        <div className={styles.graphLegend}>
          <span className={styles.graphLegendTitle}>Entity Types</span>
          {types.slice(0, 7).map((t) => (
            <span key={t} className={styles.graphLegendItem}>
              <span className={styles.graphLegendDot} style={{ background: colorOf(t) }} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className={styles.graphMeta}>
        <span>{nodesRef.current.length}</span> entities · <span>{links.length}</span> directed relations
        {links.length > MAX_EDGE_LABELS ? ` · showing ${MAX_EDGE_LABELS} edge labels` : ''}
      </div>

      {selected && (
        <div className={styles.graphDetailPanel}>
          <div className={styles.graphDetailHeader}>
            <span>{selected.kind === 'node' ? 'Node Details' : 'Relationship Path'}</span>
            {selected.kind === 'node' && selectedNode && (
              <span className={styles.graphDetailTypeBadge} style={{ background: colorOf(selectedNode.type) }}>
                {selectedNode.type}
              </span>
            )}
            <button type="button" onClick={() => setSelected(null)}>×</button>
          </div>
          {selected.kind === 'node' && selectedNode && (
            <div className={styles.graphDetailBody}>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>Name</span>
                <span className={styles.graphDetailValue}>{selectedNode.label}</span>
              </div>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>UUID</span>
                <span className={`${styles.graphDetailValue} ${styles.graphDetailCode}`}>{selectedNodeUuid}</span>
              </div>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>Degree</span>
                <span className={styles.graphDetailValue}>{selectedNode.degree} relation{selectedNode.degree === 1 ? '' : 's'}</span>
              </div>
              {selectedNodeCreated && (
                <div className={styles.graphDetailRow}>
                  <span className={styles.graphDetailLabel}>Created</span>
                  <span className={styles.graphDetailValue}>{selectedNodeCreated}</span>
                </div>
              )}
              {selectedNodeProperties.length > 0 && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Properties</span>
                  <div className={styles.graphPropertyList}>
                    {selectedNodeProperties.map((item) => (
                      <div key={item.key} className={styles.graphPropertyItem}>
                        <span>{item.key}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selectedNode.raw.summary && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Summary</span>
                  <p className={styles.graphFactText}>{selectedNode.raw.summary}</p>
                </div>
              )}
              {selectedNodeLabels.length > 0 && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Labels</span>
                  <div className={styles.graphTagList}>
                    {selectedNodeLabels.map((label) => (
                      <span key={label} className={styles.graphTag}>{label}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {selected.kind === 'edge' && selectedEdge && (
            <div className={styles.graphDetailBody}>
              <div className={styles.graphRelationHeader}>
                {selectedEdgeSource?.label || selectedEdge.source} → {selectedEdge.label} → {selectedEdgeTarget?.label || selectedEdge.target}
              </div>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>UUID</span>
                <span className={`${styles.graphDetailValue} ${styles.graphDetailCode}`}>{selectedEdgeUuid}</span>
              </div>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>Label</span>
                <span className={styles.graphDetailValue}>{selectedEdge.label}</span>
              </div>
              <div className={styles.graphDetailRow}>
                <span className={styles.graphDetailLabel}>Type</span>
                <span className={styles.graphDetailValue}>{detailValue(selectedEdge.raw.fact_type) || selectedEdge.label || 'Unknown'}</span>
              </div>
              {selectedEdge.fact && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Fact</span>
                  <p className={styles.graphFactText}>{selectedEdge.fact}</p>
                </div>
              )}
              {selectedEdgeEpisodes.length > 0 && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Episodes</span>
                  <div className={styles.graphTagList}>
                    {selectedEdgeEpisodes.map((episode) => (
                      <span key={episode} className={styles.graphTag}>{episode}</span>
                    ))}
                  </div>
                </div>
              )}
              {selectedEdgeCreated && (
                <div className={styles.graphDetailRow}>
                  <span className={styles.graphDetailLabel}>Created</span>
                  <span className={styles.graphDetailValue}>{selectedEdgeCreated}</span>
                </div>
              )}
              {selectedEdgeValidAt && (
                <div className={styles.graphDetailRow}>
                  <span className={styles.graphDetailLabel}>Valid from</span>
                  <span className={styles.graphDetailValue}>{selectedEdgeValidAt}</span>
                </div>
              )}
              {selectedEdgeExpiredAt && (
                <div className={styles.graphDetailRow}>
                  <span className={styles.graphDetailLabel}>Expired</span>
                  <span className={styles.graphDetailValue}>{selectedEdgeExpiredAt}</span>
                </div>
              )}
              {selectedEdgeProperties.length > 0 && (
                <div className={styles.graphDetailSection}>
                  <span className={styles.graphDetailSectionTitle}>Properties</span>
                  <div className={styles.graphPropertyList}>
                    {selectedEdgeProperties.map((item) => (
                      <div key={item.key} className={styles.graphPropertyItem}>
                        <span>{item.key}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
