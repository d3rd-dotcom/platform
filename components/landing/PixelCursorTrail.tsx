'use client';

import { useEffect, useRef } from 'react';

// Pixel-grid cursor trail: the pointer deposits heat into a coarse grid,
// which renders as chunky squares through a color-band lookup and decays
// each frame. Desktop pointers only; skipped on touch and reduced motion.
const CELL = 9;
const BRUSH = 10;
const DEPOSIT = 0.34;
const DECAY = 0.88;
const BANDS: Array<[number, string]> = [
  [0.1, '#1B2A6B'],
  [0.24, '#324BE4'],
  [0.42, '#5168FF'],
  [0.66, '#8FA0FF'],
];
const HOT = '#FF7729';

export const PixelCursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let cols = 0;
    let rows = 0;
    let heat = new Float32Array(0);
    let raf = 0;
    let px = -1;
    let py = -1;
    let hasHeat = false;

    const size = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cols = Math.ceil(width / CELL) + 1;
      rows = Math.ceil(height / CELL) + 1;
      heat = new Float32Array(cols * rows);
    };

    // Gaussian stamp of heat centered on (x, y)
    const deposit = (x: number, y: number, amount: number, sigma: number) => {
      const cc = x / CELL;
      const cr = y / CELL;
      const radius = Math.ceil(sigma * 1.6);
      const inv = 1 / (2 * sigma * sigma * 0.18);
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const c = (cc + dc) | 0;
          const r = (cr + dr) | 0;
          if (c < 0 || r < 0 || c >= cols || r >= rows) continue;
          const dx = c + 0.5 - cc;
          const dy = r + 0.5 - cr;
          const w = Math.exp(-(dx * dx + dy * dy) * inv);
          if (w < 0.02) continue;
          const id = r * cols + c;
          heat[id] = Math.min(1, heat[id] + amount * w);
        }
      }
      hasHeat = true;
    };

    // Stamp along the pointer path so fast flicks stay continuous
    const onMove = (e: PointerEvent) => {
      const x = e.clientX;
      const y = e.clientY;
      if (px < 0) {
        px = x;
        py = y;
      }
      const dx = x - px;
      const dy = y - py;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.min(48, Math.round(dist / (CELL * 0.8))));
      for (let s = 1; s <= steps; s++) {
        const f = s / steps;
        deposit(px + dx * f, py + dy * f, DEPOSIT, BRUSH * 0.5);
      }
      px = x;
      py = y;
    };

    const render = () => {
      raf = requestAnimationFrame(render);
      if (!hasHeat) return;
      let alive = false;
      for (let i = 0; i < heat.length; i++) {
        heat[i] *= DECAY;
        if (heat[i] < 0.003) heat[i] = 0;
        else alive = true;
      }
      ctx.clearRect(0, 0, width, height);
      const side = CELL - 1;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const v = heat[r * cols + c];
          if (v < BANDS[0][0]) continue;
          let color = BANDS[0][1];
          if (v >= BANDS[1][0]) color = BANDS[1][1];
          if (v >= BANDS[2][0]) color = BANDS[2][1];
          if (v >= BANDS[3][0]) color = BANDS[3][1];
          if (v >= 0.9) color = HOT;
          ctx.fillStyle = color;
          ctx.fillRect(c * CELL, r * CELL, side, side);
        }
      }
      if (!alive) hasHeat = false;
    };

    size();
    window.addEventListener('resize', size);
    window.addEventListener('pointermove', onMove, { passive: true });
    raf = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', size);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
};

export default PixelCursorTrail;
