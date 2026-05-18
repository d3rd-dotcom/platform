'use client';

import React, { useEffect, useRef } from 'react';
import type { Connectome as ConnectomeData, ConnectomeTier } from '@/lib/dsm-connectome';
import styles from './Connectome.module.css';

// ── Tunable physics constants ─────────────────────────────────────────────
const STEP = 0.045;        // integration step
const DAMP = 0.86;         // velocity damping per frame
const VMAX = 9;            // hard speed cap (px/frame) — prevents blow-ups
const DRIFT = 0.05;        // perpetual idle jitter (disabled for reduced motion)
const MASS: Record<ConnectomeTier, number> = { chapter: 8, disorder: 2.5, symptom: 1 };
const GRAVITY: Record<ConnectomeTier, number> = { chapter: 5, disorder: 1.1, symptom: 0.55 };
// Edge attraction tightness — smaller pulls endpoints closer together.
const TIGHT = { 'chapter-disorder': 0.62, 'disorder-symptom': 0.5, comorbid: 2.4 };

interface SimNode {
  id: string;
  label: string;
  tier: ConnectomeTier;
  chapter: string;
  chapterLabel: string;
  color: string;
  activation: number;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number;
  fy: number;
  radius: number;
}

interface SimLink {
  a: SimNode;
  b: SimNode;
  kind: 'hierarchy' | 'comorbid';
  correlation: number;
  tight: number;
}

interface Theme {
  text: string;
  textStrong: string;
  halo: string;
  edgeDim: number;
  panelBg: string;
  panelBorder: string;
}

const LIGHT: Theme = {
  text: '#6b7194',
  textStrong: '#1a1d33',
  halo: '#ffffff',
  edgeDim: 1,
  panelBg: 'rgba(255,255,255,0.96)',
  panelBorder: 'rgba(81,104,255,0.22)',
};
const DARK: Theme = {
  text: '#9aa0c0',
  textStrong: '#f0f1fa',
  halo: '#15172a',
  edgeDim: 1.15,
  panelBg: 'rgba(21,23,42,0.96)',
  panelBorder: 'rgba(124,143,255,0.34)',
};

function isDark(): boolean {
  if (typeof document === 'undefined') return false;
  return (
    document.documentElement.dataset.theme === 'dark' ||
    document.body.dataset.theme === 'dark'
  );
}

function radiusFor(tier: ConnectomeTier, activation: number): number {
  if (tier === 'chapter') return 13 + activation * 9;
  if (tier === 'disorder') return 6 + activation * 5;
  return 3 + activation * 3.6;
}

export default function Connectome({ connectome }: { connectome: ConnectomeData }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dataRef = useRef(connectome);
  dataRef.current = connectome;

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const ctx: CanvasRenderingContext2D = ctx2d;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let theme = isDark() ? DARK : LIGHT;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let nodes: SimNode[] = [];
    let links: SimLink[] = [];
    let byId = new Map<string, SimNode>();
    let neighbours = new Map<string, Set<string>>();
    let k = 60; // ideal edge length, recomputed on build

    let hoverId: string | null = null;
    let dragId: string | null = null;
    let focusChapter: string | null = null;
    let started = false;
    let raf = 0;

    // ── Build the simulation graph from the connectome data ───────────────
    function build() {
      const data = dataRef.current;
      k = Math.max(38, Math.sqrt((width * height) / Math.max(data.nodes.length, 1)) * 0.62);
      const cx = width / 2;
      const cy = height / 2;
      const chapterAngle = new Map<string, number>();
      data.chapters.forEach((c, i) => {
        chapterAngle.set(c.id, (i / data.chapters.length) * Math.PI * 2 - Math.PI / 2);
      });

      nodes = data.nodes.map((n) => {
        const angle = chapterAngle.get(n.chapter) ?? 0;
        const ring =
          n.tier === 'chapter'
            ? Math.min(width, height) * 0.17
            : n.tier === 'disorder'
              ? Math.min(width, height) * 0.3
              : Math.min(width, height) * 0.42;
        const spread = n.tier === 'chapter' ? 0 : (Math.random() - 0.5) * 1.1;
        return {
          id: n.id,
          label: n.label,
          tier: n.tier,
          chapter: n.chapter,
          chapterLabel: n.chapterLabel,
          color: n.color,
          activation: n.activation,
          degree: n.degree,
          x: cx + Math.cos(angle + spread) * ring + (Math.random() - 0.5) * 24,
          y: cy + Math.sin(angle + spread) * ring + (Math.random() - 0.5) * 24,
          vx: 0,
          vy: 0,
          fx: 0,
          fy: 0,
          radius: radiusFor(n.tier, n.activation),
        };
      });
      byId = new Map(nodes.map((n) => [n.id, n]));
      neighbours = new Map(nodes.map((n) => [n.id, new Set<string>()]));

      links = [];
      for (const l of data.links) {
        const a = byId.get(l.source);
        const b = byId.get(l.target);
        if (!a || !b) continue;
        let tight: number;
        if (l.kind === 'comorbid') tight = TIGHT.comorbid;
        else if (a.tier === 'chapter' || b.tier === 'chapter') tight = TIGHT['chapter-disorder'];
        else tight = TIGHT['disorder-symptom'];
        links.push({ a, b, kind: l.kind, correlation: l.correlation, tight });
        neighbours.get(a.id)?.add(b.id);
        neighbours.get(b.id)?.add(a.id);
      }
    }

    // ── One physics tick ─────────────────────────────────────────────────
    function tick() {
      const cx = width / 2;
      const cy = height / 2;
      for (const n of nodes) {
        n.fx = 0;
        n.fy = 0;
      }

      // Repulsion — every pair pushes apart (Fruchterman-Reingold style).
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let d2 = dx * dx + dy * dy;
          if (d2 < 1) {
            dx = Math.random() - 0.5;
            dy = Math.random() - 0.5;
            d2 = 1;
          }
          const d = Math.sqrt(d2);
          const rep = Math.min((k * k) / d, k * 6);
          const ux = dx / d;
          const uy = dy / d;
          a.fx -= ux * rep;
          a.fy -= uy * rep;
          b.fx += ux * rep;
          b.fy += uy * rep;
        }
      }

      // Attraction — edges pull endpoints toward an ideal length.
      for (const l of links) {
        let dx = l.b.x - l.a.x;
        let dy = l.b.y - l.a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const att = ((d * d) / (k * l.tight)) * (0.6 + l.correlation * 0.9);
        const ux = dx / d;
        const uy = dy / d;
        l.a.fx += ux * att;
        l.a.fy += uy * att;
        l.b.fx -= ux * att;
        l.b.fy -= uy * att;
      }

      // Centering gravity + integration.
      for (const n of nodes) {
        if (n.id === dragId) continue;
        const g = GRAVITY[n.tier];
        n.fx += (cx - n.x) * g;
        n.fy += (cy - n.y) * g;
        const mass = MASS[n.tier];
        let vx = (n.vx + (n.fx / mass) * STEP) * DAMP;
        let vy = (n.vy + (n.fy / mass) * STEP) * DAMP;
        if (!reduced) {
          vx += (Math.random() - 0.5) * DRIFT;
          vy += (Math.random() - 0.5) * DRIFT;
        }
        const speed = Math.hypot(vx, vy);
        if (speed > VMAX) {
          vx = (vx / speed) * VMAX;
          vy = (vy / speed) * VMAX;
        }
        n.vx = vx;
        n.vy = vy;
        n.x += vx;
        n.y += vy;
        // Soft bounds.
        const pad = n.radius + 8;
        if (n.x < pad) { n.x = pad; n.vx *= -0.4; }
        if (n.x > width - pad) { n.x = width - pad; n.vx *= -0.4; }
        if (n.y < pad) { n.y = pad; n.vy *= -0.4; }
        if (n.y > height - pad) { n.y = height - pad; n.vy *= -0.4; }
      }
    }

    // ── Render ───────────────────────────────────────────────────────────
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const active = hoverId ?? null;
      const activeSet = active ? neighbours.get(active) : null;
      const dimmed = (id: string, chapter: string): boolean => {
        if (active) return id !== active && !activeSet?.has(id);
        if (focusChapter) return chapter !== focusChapter;
        return false;
      };

      // Edges.
      for (const l of links) {
        const litByHover =
          active && (l.a.id === active || l.b.id === active);
        const faded =
          (active && !litByHover) ||
          (focusChapter && l.a.chapter !== focusChapter && l.b.chapter !== focusChapter);
        const base =
          l.kind === 'comorbid'
            ? 0.22 + l.correlation * 0.5
            : 0.1 + l.correlation * 0.42;
        ctx.globalAlpha = (litByHover ? 0.95 : faded ? 0.04 : base) / theme.edgeDim;
        ctx.strokeStyle = l.a.tier === 'chapter' ? l.a.color : l.b.color;
        ctx.lineWidth =
          (l.kind === 'comorbid' ? 1 + l.correlation * 4 : 0.5 + l.correlation * 2) *
          (litByHover ? 1.6 : 1);
        ctx.beginPath();
        ctx.moveTo(l.a.x, l.a.y);
        ctx.lineTo(l.b.x, l.b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes — draw symptoms, then disorders, then chapters on top.
      const order: ConnectomeTier[] = ['symptom', 'disorder', 'chapter'];
      for (const tier of order) {
        for (const n of nodes) {
          if (n.tier !== tier) continue;
          const faded = dimmed(n.id, n.chapter);
          ctx.globalAlpha = faded ? 0.12 : 1;
          // Activation glow.
          const glow = n.radius * (1.7 + n.activation * 1.4);
          const grad = ctx.createRadialGradient(n.x, n.y, n.radius * 0.5, n.x, n.y, glow);
          grad.addColorStop(0, `${n.color}${faded ? '14' : '4d'}`);
          grad.addColorStop(1, `${n.color}00`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(n.x, n.y, glow, 0, Math.PI * 2);
          ctx.fill();
          // Core.
          ctx.fillStyle = n.color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = n.tier === 'chapter' ? 2 : 1.2;
          ctx.strokeStyle = theme.halo;
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;

      // Labels — chapters + disorders always, symptoms near hover only.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const n of nodes) {
        const faded = dimmed(n.id, n.chapter);
        const isHoverScope =
          n.id === active || (activeSet ? activeSet.has(n.id) : false);
        let show = n.tier === 'chapter' || n.tier === 'disorder';
        if (n.tier === 'symptom') show = isHoverScope;
        if (!show) continue;
        if (faded && n.tier !== 'chapter') continue;
        const big = n.tier === 'chapter';
        ctx.font = `${big ? 700 : 600} ${big ? 12 : 9}px -apple-system, system-ui, sans-serif`;
        const ly = n.y + n.radius + (big ? 11 : 8);
        ctx.lineWidth = 3;
        ctx.strokeStyle = theme.halo;
        ctx.globalAlpha = faded ? 0.4 : 1;
        ctx.strokeText(n.label, n.x, ly);
        ctx.fillStyle = big ? theme.textStrong : theme.text;
        ctx.fillText(n.label, n.x, ly);
      }
      ctx.globalAlpha = 1;

      // Hover tooltip.
      if (active) {
        const n = byId.get(active);
        if (n) drawTooltip(n);
      }
    }

    function drawTooltip(n: SimNode) {
      const lines = [
        n.label,
        n.tier === 'chapter' ? 'DSM chapter' : n.tier === 'disorder' ? `Disorder · ${n.chapterLabel}` : `Symptom · ${n.chapterLabel}`,
        `Activation ${Math.round(n.activation * 100)}%  ·  ${n.degree} links`,
      ];
      ctx.font = '600 11px -apple-system, system-ui, sans-serif';
      let w = 0;
      for (const line of lines) w = Math.max(w, ctx.measureText(line).width);
      const padX = 10;
      const padY = 8;
      const lh = 15;
      const boxW = w + padX * 2;
      const boxH = lines.length * lh + padY * 2 - 3;
      let bx = n.x + n.radius + 10;
      let by = n.y - boxH / 2;
      if (bx + boxW > width) bx = n.x - n.radius - 10 - boxW;
      by = Math.max(4, Math.min(by, height - boxH - 4));

      ctx.fillStyle = theme.panelBg;
      ctx.strokeStyle = theme.panelBorder;
      ctx.lineWidth = 1;
      roundRect(bx, by, boxW, boxH, 9);
      ctx.fill();
      ctx.stroke();

      ctx.textAlign = 'left';
      lines.forEach((line, i) => {
        if (i === 0) {
          ctx.font = '700 11.5px -apple-system, system-ui, sans-serif';
          ctx.fillStyle = n.color;
        } else {
          ctx.font = '500 10.5px -apple-system, system-ui, sans-serif';
          ctx.fillStyle = theme.text;
        }
        ctx.fillText(line, bx + padX, by + padY + i * lh + 6);
      });
      ctx.textAlign = 'center';
    }

    function roundRect(x: number, y: number, w: number, h: number, r: number) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    function frame() {
      tick();
      draw();
      raf = requestAnimationFrame(frame);
    }

    // ── Pointer interaction ──────────────────────────────────────────────
    function pointAt(e: PointerEvent): { x: number; y: number } {
      const rect = canvas!.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function hit(x: number, y: number): SimNode | null {
      let best: SimNode | null = null;
      let bestD = Infinity;
      for (const n of nodes) {
        const d = Math.hypot(n.x - x, n.y - y);
        if (d <= n.radius + 5 && d < bestD) {
          bestD = d;
          best = n;
        }
      }
      return best;
    }

    function onPointerDown(e: PointerEvent) {
      const p = pointAt(e);
      const n = hit(p.x, p.y);
      if (n) {
        dragId = n.id;
        canvas!.setPointerCapture(e.pointerId);
        canvas!.style.cursor = 'grabbing';
      }
    }
    function onPointerMove(e: PointerEvent) {
      const p = pointAt(e);
      if (dragId) {
        const n = byId.get(dragId);
        if (n) {
          n.x = p.x;
          n.y = p.y;
          n.vx = 0;
          n.vy = 0;
        }
        return;
      }
      const n = hit(p.x, p.y);
      hoverId = n?.id ?? null;
      canvas!.style.cursor = n ? 'grab' : 'default';
    }
    function onPointerUp(e: PointerEvent) {
      if (dragId) {
        try { canvas!.releasePointerCapture(e.pointerId); } catch { /* noop */ }
        dragId = null;
        canvas!.style.cursor = 'default';
      }
    }
    function onLeave() {
      if (!dragId) hoverId = null;
    }

    // ── Sizing + theme observers ─────────────────────────────────────────
    function resize() {
      const rect = wrap!.getBoundingClientRect();
      width = Math.max(rect.width, 1);
      height = Math.max(rect.height, 1);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      if (!started && width > 2 && height > 2) {
        build();
        started = true;
        raf = requestAnimationFrame(frame);
      }
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();

    const themeObserver = new MutationObserver(() => {
      theme = isDark() ? DARK : LIGHT;
    });
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    themeObserver.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    canvas.addEventListener('pointerleave', onLeave);

    // Legend hover focus — dispatched from the JSX chips below.
    function onFocus(e: Event) {
      focusChapter = (e as CustomEvent<string | null>).detail;
    }
    wrap.addEventListener('connectome-focus', onFocus);

    // Sync activation when the connectome prop changes (taxonomy is stable).
    let lastVersion = `${connectome.source}:${connectome.generatedAt}`;
    const syncInterval = window.setInterval(() => {
      const data = dataRef.current;
      const version = `${data.source}:${data.generatedAt}`;
      if (version === lastVersion || !started) return;
      lastVersion = version;
      for (const dn of data.nodes) {
        const sn = byId.get(dn.id);
        if (sn) {
          sn.activation = dn.activation;
          sn.radius = radiusFor(sn.tier, dn.activation);
        }
      }
      const corr = new Map(data.links.map((l) => [`${l.source}>${l.target}`, l.correlation]));
      for (const l of links) {
        const c = corr.get(`${l.a.id}>${l.b.id}`);
        if (c !== undefined) l.correlation = c;
      }
    }, 600);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      themeObserver.disconnect();
      window.clearInterval(syncInterval);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('pointerleave', onLeave);
      wrap.removeEventListener('connectome-focus', onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFocus = (chapter: string | null) => {
    wrapRef.current?.dispatchEvent(
      new CustomEvent('connectome-focus', { detail: chapter }),
    );
  };

  const nodeCount = connectome.nodes.length;
  const linkCount = connectome.links.length;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.meta}>
        {nodeCount} nodes · {linkCount} edges
      </div>
      <div className={styles.legend}>
        {connectome.chapters.map((c) => (
          <button
            key={c.id}
            type="button"
            className={styles.legendItem}
            onMouseEnter={() => setFocus(c.id)}
            onMouseLeave={() => setFocus(null)}
            onFocus={() => setFocus(c.id)}
            onBlur={() => setFocus(null)}
          >
            <span className={styles.legendDot} style={{ background: c.color }} />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}
