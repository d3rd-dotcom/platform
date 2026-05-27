'use client';

import { useEffect, useRef, type CSSProperties } from 'react';

type Props = {
  className?: string;
};

const PAL = {
  indigo: '#4F46E5',
  mint: '#6EE7B7',
  aqua: '#7FFFD4',
};

const wrapperStyle: CSSProperties = {
  position: 'relative',
  width: '100%',
  maxWidth: 460,
  height: 420,
};

const canvasStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '100%',
};

export default function ShardsAltar({ className = '' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = 0;
    let H = 0;
    let cx = 0;
    let cy = 0;
    let rot = 0;
    let rafId = 0;

    const resize = () => {
      const r = wrap.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx = W * 0.5;
      cy = H * 0.5;
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    const drawPlate = (x: number, y: number, w: number, color: string, alpha: number) => {
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(x, y - w * 0.35);
      ctx.lineTo(x + w, y);
      ctx.lineTo(x, y + w * 0.35);
      ctx.lineTo(x - w, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    };

    const drawCube = (t: number) => {
      const size = Math.min(W * 0.22, 130);
      const wobble = Math.sin(t * 0.001) * 4;

      const glow = ctx.createRadialGradient(cx, cy + 60, 0, cx, cy + 60, size * 1.8);
      glow.addColorStop(0, 'rgba(78, 70, 229, 0.5)');
      glow.addColorStop(1, 'rgba(78, 70, 229, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(cx - size * 2, cy - size, size * 4, size * 3);

      drawPlate(cx, cy + size * 1.05, size * 1.05, PAL.indigo, 0.85);
      drawPlate(cx, cy + size * 0.95, size * 0.92, PAL.mint, 0.85);

      const a = rot;
      ctx.fillStyle = 'rgba(61,61,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - size + wobble);
      ctx.lineTo(cx + size, cy - size / 2 + wobble);
      ctx.lineTo(cx, cy + wobble);
      ctx.lineTo(cx - size, cy - size / 2 + wobble);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(30,27,122, ${0.85 + Math.sin(a) * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(cx - size, cy - size / 2 + wobble);
      ctx.lineTo(cx, cy + wobble);
      ctx.lineTo(cx, cy + size + wobble);
      ctx.lineTo(cx - size, cy + size / 2 + wobble);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = `rgba(79,70,229, ${0.85 + Math.cos(a) * 0.15})`;
      ctx.beginPath();
      ctx.moveTo(cx + size, cy - size / 2 + wobble);
      ctx.lineTo(cx, cy + wobble);
      ctx.lineTo(cx, cy + size + wobble);
      ctx.lineTo(cx + size, cy + size / 2 + wobble);
      ctx.closePath();
      ctx.fill();

      const pulse = (Math.sin(t * 0.003) + 1) * 0.5;
      ctx.fillStyle = `rgba(110, 231, 183, ${0.2 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(cx, cy + wobble, size * 0.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = 'rgba(232, 230, 245, 0.5)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx, cy - size + wobble);
      ctx.lineTo(cx + size, cy - size / 2 + wobble);
      ctx.lineTo(cx, cy + wobble);
      ctx.lineTo(cx - size, cy - size / 2 + wobble);
      ctx.closePath();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + wobble);
      ctx.lineTo(cx, cy + size + wobble);
      ctx.stroke();

      for (let i = 0; i < 6; i++) {
        const ang = a + i * ((Math.PI * 2) / 6);
        const sx = cx + Math.cos(ang) * size * 1.4;
        const sy = cy + Math.sin(ang) * size * 0.55 + wobble;
        ctx.fillStyle = i % 2 ? PAL.mint : PAL.aqua;
        ctx.globalAlpha = 0.6 + Math.sin(t * 0.004 + i) * 0.3;
        ctx.beginPath();
        ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const draw = (t: number) => {
      ctx.clearRect(0, 0, W, H);
      rot += 0.005;
      drawCube(t);
      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className={className} style={wrapperStyle}>
      <canvas ref={canvasRef} style={canvasStyle} />
    </div>
  );
}
