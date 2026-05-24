'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { GraphData } from '@/lib/simulation-api';
import styles from './simulation.module.css';

/**
 * Knowledge-graph viewer. Self-contained force-directed layout (no d3 dep):
 * charge repulsion + link springs + centering gravity + collision, integrated
 * over a few hundred ticks then rendered as polished SVG — nodes are sized by
 * connection count, coloured by entity type, lit with a soft glow + highlight,
 * and labelled with haloed text for the most-connected entities.
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

const W = 560;
const H = 560;
const MAX_NODES = 120;

const TYPE_COLORS = ['#5168FF', '#9724A6', '#1FAA8C', '#E0701A', '#C73E6B', '#3B82F6', '#8B5CF6'];

export default function GraphPanel({ graph }: { graph: GraphData | null }) {
  const [, force] = useState(0);
  const nodesRef = useRef<SimNode[]>([]);
  const rafRef = useRef<number>();

  const { nodes, links, types, colorOf } = useMemo(() => {
    if (!graph?.nodes?.length) {
      return { nodes: [] as SimNode[], links: [], types: [] as string[], colorOf: () => '#5168FF' };
    }
    const sliced = graph.nodes.slice(0, MAX_NODES);
    const ids = new Set(sliced.map((n) => n.id));
    const rawLinks = (graph.edges || []).filter((e) => ids.has(e.source) && ids.has(e.target));

    // degree per node → drives radius + label priority
    const degree = new Map<string, number>();
    for (const l of rawLinks) {
      degree.set(l.source, (degree.get(l.source) || 0) + 1);
      degree.set(l.target, (degree.get(l.target) || 0) + 1);
    }

    const types = Array.from(new Set(sliced.map((n) => n.type || n.labels?.[0] || 'Entity')));
    const colorOf = (t: string) => TYPE_COLORS[Math.max(0, types.indexOf(t)) % TYPE_COLORS.length];

    const nodes: SimNode[] = sliced.map((n, i) => {
      const deg = degree.get(n.id) || 0;
      const angle = (i / sliced.length) * Math.PI * 2;
      return {
        id: n.id,
        label: n.name || n.label || String(n.id),
        type: n.type || n.labels?.[0] || 'Entity',
        degree: deg,
        r: 7 + Math.min(14, deg * 2.2),
        x: W / 2 + Math.cos(angle) * 170,
        y: H / 2 + Math.sin(angle) * 170,
        vx: 0,
        vy: 0,
      };
    });
    return { nodes, links: rawLinks, types, colorOf };
  }, [graph]);

  useEffect(() => {
    nodesRef.current = nodes;
    if (!nodes.length) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    let ticks = 0;

    const step = () => {
      const ns = nodesRef.current;
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const a = ns[i];
          const b = ns[j];
          let dx = a.x - b.x;
          let dy = a.y - b.y;
          let d2 = dx * dx + dy * dy || 0.01;
          let d = Math.sqrt(d2);
          // charge repulsion
          const f = 2600 / d2;
          let fx = (dx / d) * f;
          let fy = (dy / d) * f;
          // collision: hard push when circles overlap
          const minD = a.r + b.r + 6;
          if (d < minD) {
            const push = (minD - d) * 0.5;
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
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const f = (d - 96) * 0.018;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
      for (const n of ns) {
        n.vx += (W / 2 - n.x) * 0.004;
        n.vy += (H / 2 - n.y) * 0.004;
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x += n.vx;
        n.y += n.vy;
        const m = n.r + 6;
        n.x = Math.max(m, Math.min(W - m, n.x));
        n.y = Math.max(m, Math.min(H - m, n.y));
      }
      ticks++;
      force((c) => c + 1);
      if (ticks < 320) rafRef.current = requestAnimationFrame(step);
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
          <line x1="14" y1="16" x2="34" y2="13" stroke="#5168FF" strokeWidth="1" opacity="0.3" />
          <line x1="14" y1="16" x2="30" y2="34" stroke="#5168FF" strokeWidth="1" opacity="0.3" />
        </svg>
        <p>No graph yet</p>
        <span>The knowledge graph appears here once it is built.</span>
      </div>
    );
  }

  const byId = new Map(nodesRef.current.map((n) => [n.id, n]));
  // Label only the most-connected entities to avoid clutter.
  const labelThreshold = (() => {
    const degs = nodesRef.current.map((n) => n.degree).sort((a, b) => b - a);
    return degs[Math.min(degs.length - 1, 11)] ?? 0;
  })();

  return (
    <div className={styles.graphWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.graphSvg}>
        <defs>
          <radialGradient id="graphVignette" cx="50%" cy="42%" r="70%">
            <stop offset="0%" stopColor="rgba(81,104,255,0.10)" />
            <stop offset="100%" stopColor="rgba(81,104,255,0)" />
          </radialGradient>
          <filter id="nodeGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width={W} height={H} fill="url(#graphVignette)" />

        {/* edges */}
        <g>
          {links.map((l, i) => {
            const a = byId.get(l.source);
            const b = byId.get(l.target);
            if (!a || !b) return null;
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="rgba(120,134,210,0.28)"
                strokeWidth={1}
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* nodes */}
        <g>
          {nodesRef.current.map((n, i) => {
            const c = colorOf(n.type);
            const showLabel = n.degree >= labelThreshold && n.degree > 0;
            return (
              <g key={`${n.id}-${i}`} transform={`translate(${n.x},${n.y})`}>
                {/* glow halo */}
                <circle r={n.r + 3} fill={c} opacity={0.22} filter="url(#nodeGlow)" />
                {/* body */}
                <circle r={n.r} fill={c} stroke="rgba(255,255,255,0.65)" strokeWidth={1} />
                {/* glossy highlight */}
                <circle cx={-n.r * 0.3} cy={-n.r * 0.34} r={n.r * 0.42} fill="rgba(255,255,255,0.45)" />
                {showLabel && (
                  <text
                    y={n.r + 11}
                    textAnchor="middle"
                    className={styles.graphNodeLabel}
                  >
                    {n.label.length > 20 ? n.label.slice(0, 19) + '…' : n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

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
        {graph.nodes.length} entities · {(graph.edges || []).length} relations
      </div>
    </div>
  );
}
