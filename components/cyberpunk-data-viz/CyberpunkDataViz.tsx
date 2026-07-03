'use client';

import { useEffect, useRef, useCallback } from 'react';

function isInsideMap(x: number, y: number, width: number, height: number) {
  const nx = x / width;
  const ny = y / height;
  if (nx < 0.02 || nx > 0.99) return false;
  if (ny < 0.02 || ny > 0.99) return false;
  return true;
}

interface GridCell {
  x: number;
  y: number;
  char: string;
  opacity: number;
  hue: number;
  pulseOffset: number;
  size: number;
  sprite?: HTMLCanvasElement;
  glow?: HTMLCanvasElement | null;
  spriteSize?: number;
  alphaFactor?: number;
}

const MAX_FPS = 30;
// Padding around each pre-rendered glyph so the baked glow halo isn't clipped.
const SPRITE_PAD = 8;

const HUE_COLORS: Record<number, { rgb: string; alphaFactor: number }> = {
  320: { rgb: 'rgb(81, 104, 255)', alphaFactor: 0.4 },
  280: { rgb: 'rgb(140, 100, 220)', alphaFactor: 0.3 },
  200: { rgb: 'rgb(26, 29, 51)', alphaFactor: 0.15 },
};

// Filling thousands of glyphs with fillText (and shadowBlur for the glow)
// every frame is the main cost of this effect, so each char/size/hue combo
// is rendered once to a small canvas and blitted with drawImage after that.
// Per-cell alpha animation happens via globalAlpha, which keeps the frame
// loop free of string building and canvas state churn.
function makeSprite(
  char: string,
  size: number,
  color: string,
  withGlow: boolean,
  dpr: number
): HTMLCanvasElement {
  const css = size + SPRITE_PAD * 2;
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(css * dpr));
  c.height = c.width;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.scale(dpr, dpr);
    ctx.font = `${size}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    if (withGlow) {
      ctx.shadowColor = 'rgba(81, 104, 255, 0.3)';
      ctx.shadowBlur = 6;
    }
    ctx.fillText(char, css / 2, css / 2);
  }
  return c;
}

function buildAtlas(dpr: number) {
  const atlas = new Map<string, { base: HTMLCanvasElement; glow: HTMLCanvasElement | null }>();
  for (const char of ['7', '0']) {
    for (const size of [9, 11]) {
      for (const hue of [320, 280, 200]) {
        atlas.set(`${char}|${size}|${hue}`, {
          base: makeSprite(char, size, HUE_COLORS[hue].rgb, false, dpr),
          glow: hue === 320 ? makeSprite(char, size, HUE_COLORS[hue].rgb, true, dpr) : null,
        });
      }
    }
  }
  return atlas;
}

export default function CyberpunkDataViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const timeRef = useRef(0);
  const gridDataRef = useRef<GridCell[] | null>(null);
  const pausedRef = useRef(false);
  const reducedMotionRef = useRef(false);

  const initGrid = useCallback((w: number, h: number): GridCell[] => {
    const cellSize = 14;
    const cols = Math.floor(w / cellSize);
    const rows = Math.floor(h / cellSize);
    const grid: GridCell[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellSize + cellSize / 2;
        const y = r * cellSize + cellSize / 2;
        if (isInsideMap(x, y, w, h)) {
          grid.push({
            x, y,
            char: Math.random() > 0.35 ? '7' : '0',
            opacity: Math.random() * 0.6 + 0.4,
            hue: Math.random() > 0.6 ? 320 : (Math.random() > 0.5 ? 280 : 200),
            pulseOffset: Math.random() * Math.PI * 2,
            size: Math.random() > 0.9 ? 11 : 9,
          });
        }
      }
    }
    return grid;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const context = ctx;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = motionQuery.matches;

    let width = 0;
    let height = 0;

    const drawStaticFrame = () => {
      const grid = gridDataRef.current;
      if (!grid) return;
      context.clearRect(0, 0, width, height);

      for (const cell of grid) {
        let color;
        if (cell.hue === 320) {
          color = 'rgba(81, 104, 255, 0.22)';
        } else if (cell.hue === 280) {
          color = 'rgba(140, 100, 220, 0.18)';
        } else {
          color = 'rgba(26, 29, 51, 0.12)';
        }

        context.fillStyle = color;
        context.font = `${cell.size}px "Courier New", monospace`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(cell.char, cell.x, cell.y);
      }
    };

    const syncCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      width = parent.offsetWidth;
      height = parent.offsetHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.scale(dpr, dpr);

      const atlas = buildAtlas(dpr);
      const grid = initGrid(width, height);
      for (const cell of grid) {
        const sprites = atlas.get(`${cell.char}|${cell.size}|${cell.hue}`);
        cell.sprite = sprites?.base;
        cell.glow = sprites?.glow ?? null;
        cell.spriteSize = cell.size + SPRITE_PAD * 2;
        cell.alphaFactor = HUE_COLORS[cell.hue]?.alphaFactor ?? 0.15;
      }
      gridDataRef.current = grid;

      if (reducedMotionRef.current) {
        drawStaticFrame();
      }
    };

    syncCanvas();

    let lastDraw = 0;
    // Small slack so a 60Hz rAF cadence lands cleanly on every other frame.
    const minFrameMs = 1000 / MAX_FPS - 2;

    function drawFrame(t: number) {
      if (pausedRef.current || reducedMotionRef.current) {
        animRef.current = 0;
        return;
      }
      animRef.current = requestAnimationFrame(drawFrame);
      if (t - lastDraw < minFrameMs) return;
      lastDraw = t;

      timeRef.current = t * 0.001;
      const time = timeRef.current;
      const grid = gridDataRef.current;
      if (!grid) return;
      context.clearRect(0, 0, width, height);

      for (const cell of grid) {
        if (!cell.sprite) continue;
        const pulse = Math.sin(time * 1.5 + cell.pulseOffset) * 0.15;
        const wave = Math.sin(time * 0.8 + cell.x * 0.01 + cell.y * 0.008) * 0.1;
        const alpha = Math.min(1, Math.max(0.1, cell.opacity + pulse + wave));

        const s = cell.spriteSize!;
        const half = s / 2;
        context.globalAlpha = alpha * cell.alphaFactor!;
        context.drawImage(cell.sprite, cell.x - half, cell.y - half, s, s);

        if (alpha > 0.7 && cell.glow) {
          context.drawImage(cell.glow, cell.x - half, cell.y - half, s, s);
        }
      }

      context.fillStyle = 'rgb(81, 104, 255)';
      for (let sy = 0; sy < height; sy += 3) {
        context.globalAlpha = 0.02 + Math.sin(time * 2 + sy * 0.1) * 0.01;
        context.fillRect(0, sy, width, 1);
      }

      const floatingNums = [
        { text: '8.21', x: width * 0.65, y: height * 0.22 },
        { text: '0.37', x: width * 0.30, y: height * 0.50 },
        { text: '8.21', x: width * 0.55, y: height * 0.45 },
      ];
      context.font = '10px "Courier New", monospace';
      context.textAlign = 'center';
      for (const fn of floatingNums) {
        const fAlpha = 0.3 + Math.sin(time * 1.2 + fn.x) * 0.2;
        context.globalAlpha = Math.min(1, Math.max(0, fAlpha));
        context.fillText(fn.text, fn.x, fn.y + Math.sin(time + fn.x) * 3);
      }
      context.globalAlpha = 1;
    }

    let tabHidden = false;
    let offscreen = false;
    const updatePaused = () => {
      pausedRef.current = tabHidden || offscreen;
      if (!pausedRef.current && !reducedMotionRef.current && animRef.current === 0) {
        animRef.current = requestAnimationFrame(drawFrame);
      }
    };

    const handleVisibilityChange = () => {
      tabHidden = document.visibilityState !== 'visible';
      updatePaused();
    };

    // Don't render while scrolled out of view.
    const io = new IntersectionObserver(([entry]) => {
      offscreen = !entry.isIntersecting;
      updatePaused();
    });
    io.observe(canvas);

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotionRef.current = event.matches;
      if (event.matches) {
        if (animRef.current) {
          cancelAnimationFrame(animRef.current);
          animRef.current = 0;
        }
        drawStaticFrame();
        return;
      }

      if (!pausedRef.current && animRef.current === 0) {
        animRef.current = requestAnimationFrame(drawFrame);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      syncCanvas();
    });

    resizeObserver.observe(parent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    motionQuery.addEventListener('change', handleMotionChange);

    if (!reducedMotionRef.current) {
      animRef.current = requestAnimationFrame(drawFrame);
    }

    return () => {
      resizeObserver.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      motionQuery.removeEventListener('change', handleMotionChange);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [initGrid]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    />
  );
}
