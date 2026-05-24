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
}

interface SimLink {
  id: string;
  source: string;
  target: string;
  label: string;
  fact?: string;
  isExpired: boolean;
  pairOffset: number;
}

const W = 560;
const H = 500;
const MAX_NODES = 120;
const MAX_EDGE_LABELS = 48;

const TYPE_COLORS = ['#5168FF', '#9724A6', '#1FAA8C', '#E0701A', '#C73E6B', '#3B82F6', '#8B5CF6'];

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '');

function nodeId(n: GraphNode) {
  return str(n.id) || str(n.uuid) || str(n.attributes?.id) || str(n.name) || str(n.label);
}

function nodeLabel(n: GraphNode, id: string) {
  return str(n.name) || str(n.label) || str(n.attributes?.name) || id;
}

function nodeType(n: GraphNode) {
  return str(n.type) || str(n.labels?.[0]) || str(n.attributes?.type) || 'Entity';
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

function edgePath(a: SimNode, b: SimNode, offset: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (a === b || (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01)) {
    const loop = a.r + 34 + Math.abs(offset);
    const sx = a.x + a.r * 0.72;
    const sy = a.y - a.r * 0.72;
    const tx = a.x - a.r * 0.72;
    const ty = a.y - a.r * 0.72;
    return {
      d: `M ${sx} ${sy} C ${a.x + loop} ${a.y - loop} ${a.x - loop} ${a.y - loop} ${tx} ${ty}`,
      labelX: a.x,
      labelY: a.y - loop,
      angle: 0,
    };
  }
  const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
  const ux = dx / d;
  const uy = dy / d;
  const nx = -uy;
  const ny = ux;
  const sx = a.x + ux * (a.r + 4) + nx * offset;
  const sy = a.y + uy * (a.r + 4) + ny * offset;
  const tx = b.x - ux * (b.r + 9) + nx * offset;
  const ty = b.y - uy * (b.r + 9) + ny * offset;
  const cx = (sx + tx) / 2 + nx * offset * 1.4;
  const cy = (sy + ty) / 2 + ny * offset * 1.4;
  return { d: `M ${sx} ${sy} Q ${cx} ${cy} ${tx} ${ty}`, labelX: cx, labelY: cy, angle: Math.atan2(ty - sy, tx - sx) * 180 / Math.PI };
}

export default function GraphPanel({ graph }: { graph: GraphData | null }) {
  const [, force] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const nodesRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number>();
  const dragRef = useRef<{ x: number; y: number; viewX: number; viewY: number } | null>(null);

  const { nodes, links, types, colorOf } = useMemo(() => {
    if (!graph?.nodes?.length) {
      return { nodes: [] as SimNode[], links: [] as SimLink[], types: [] as string[], colorOf: () => '#5168FF' };
    }

    const rawNodes = graph.nodes
      .map((n) => ({ raw: n, id: nodeId(n) }))
      .filter((n) => n.id)
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
      const key = `${l.source}->${l.target}`;
      pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
    }
    for (const l of normalizedLinks) {
      const key = `${l.source}->${l.target}`;
      const seen = pairSeen.get(key) || 0;
      const total = pairCounts.get(key) || 1;
      pairSeen.set(key, seen + 1);
      l.pairOffset = (seen - (total - 1) / 2) * 18;
    }

    const types = Array.from(new Set(rawNodes.map(({ raw }) => nodeType(raw))));
    const colorOf = (t: string) => TYPE_COLORS[Math.max(0, types.indexOf(t)) % TYPE_COLORS.length];

    const nodes: SimNode[] = rawNodes.map(({ raw, id }, i) => {
      const deg = degree.get(id) || 0;
      const angle = (i / rawNodes.length) * Math.PI * 2;
      const orbit = 120 + Math.min(100, rawNodes.length * 4);
      return {
        id,
        label: nodeLabel(raw, id),
        type: nodeType(raw),
        degree: deg,
        r: 13 + Math.min(12, deg * 1.7),
        x: W / 2 + Math.cos(angle) * orbit,
        y: H / 2 + Math.sin(angle) * orbit,
        vx: 0,
        vy: 0,
      };
    });

    return { nodes, links: normalizedLinks, types, colorOf };
  }, [graph]);

  useEffect(() => {
    nodesRef.current = nodes;
    setView({ x: 0, y: 0, k: 1 });
    if (!nodes.length) return;

    const byId = new Map(nodes.map((n) => [n.id, n]));
    let ticks = 0;

    const step = () => {
      const ns = nodesRef.current;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const f = 4300 / d2;
          let fx = (dx / d) * f;
          let fy = (dy / d) * f;
          const minD = a.r + b.r + 34;
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
        const targetDistance = 145 + Math.min(55, Math.abs(l.pairOffset));
        const f = (d - targetDistance) * 0.016;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.0035;
        n.vy += (H / 2 - n.y) * 0.0035;
        n.vx *= 0.82;
        n.vy *= 0.82;
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

  const zoom = (next: number) => setView((v) => ({ ...v, k: Math.max(0.55, Math.min(2.4, next)) }));

  return (
    <div className={styles.graphWrap}>
      <div className={styles.graphControls} aria-label="Graph controls">
        <button type="button" onClick={() => zoom(view.k * 1.18)}>+</button>
        <button type="button" onClick={() => zoom(view.k / 1.18)}>−</button>
        <button type="button" onClick={() => setView({ x: 0, y: 0, k: 1 })}>Reset</button>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.graphSvg}
        onWheel={(e) => {
          e.preventDefault();
          zoom(view.k * (e.deltaY > 0 ? 0.9 : 1.1));
        }}
        onPointerDown={(e) => {
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
            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(86,100,172,0.78)" />
          </marker>
          <marker id="graphArrowFaded" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 Z" fill="rgba(120,125,150,0.38)" />
          </marker>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#graphVignette)" />
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          <g className={styles.graphEdges}>
            {links.map((l) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const path = edgePath(a, b, l.pairOffset);
              return (
                <path
                  key={l.id}
                  d={path.d}
                  className={l.isExpired ? styles.graphEdgeExpired : styles.graphEdge}
                  markerEnd={l.isExpired ? 'url(#graphArrowFaded)' : 'url(#graphArrow)'}
                >
                  {l.fact && <title>{`${a.label} → ${l.label} → ${b.label}\n${l.fact}`}</title>}
                </path>
              );
            })}
          </g>

          <g className={styles.graphEdgeLabels}>
            {labeledLinks.map((l) => {
              const a = byId.get(l.source);
              const b = byId.get(l.target);
              if (!a || !b) return null;
              const path = edgePath(a, b, l.pairOffset);
              const label = truncate(l.label, 24);
              const labelWidth = Math.max(42, label.length * 7.2 + 12);
              return (
                <g key={`${l.id}-label`} transform={`translate(${path.labelX},${path.labelY}) rotate(${path.angle > 90 || path.angle < -90 ? path.angle + 180 : path.angle})`}>
                  <rect x={-labelWidth / 2} y="-10" width={labelWidth} height="20" rx="10" />
                  <text textAnchor="middle" dominantBaseline="middle">
                    {label}
                  </text>
                </g>
              );
            })}
          </g>

          <g className={styles.graphNodes}>
            {nodesRef.current.map((n, i) => {
              const c = colorOf(n.type);
              const showLabel = showAllNodeLabels || n.degree >= 2;
              return (
                <g key={`${n.id}-${i}`} transform={`translate(${n.x},${n.y})`}>
                  <circle r={n.r + 4} fill={c} opacity={0.18} filter="url(#nodeGlow)" />
                  <circle r={n.r} fill={c} stroke="rgba(255,255,255,0.72)" strokeWidth={1.2} />
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

      <div className={styles.graphHint}>Drag to pan · scroll to zoom · arrows show source → relationship → target</div>

      {types.length > 0 && (
        <div className={styles.graphLegend}>
          {types.slice(0, 7).map((t) => (
            <span key={t} className={styles.graphLegendItem}>
              <span className={styles.graphLegendDot} style={{ background: colorOf(t) }} />
              {t}
            </span>
          ))}
        </div>
      )}

      <div className={styles.graphMeta}>
        {graph.nodes.length} entities · {(graph.edges || []).length} directed relations
        {links.length > MAX_EDGE_LABELS ? ` · showing ${MAX_EDGE_LABELS} edge labels` : ''}
      </div>
    </div>
  );
}
