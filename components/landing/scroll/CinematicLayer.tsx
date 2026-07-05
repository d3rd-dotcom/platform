'use client';

import { useEffect, useRef } from 'react';
import styles from './CinematicLayer.module.css';

const PARTICLE_COUNT = 36;

type Mote = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  drift: number;
  alpha: number;
};

// Fixed overlay owning every full-viewport treatment: film grain, vignette,
// act tint wash, and drifting particle motes. Sections never stack their own.
export function CinematicLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let raf = 0;
    let running = true;

    const seed = (): Mote => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 0.6 + Math.random() * 1.6,
      speed: 0.1 + Math.random() * 0.25,
      drift: (Math.random() - 0.5) * 0.12,
      alpha: 0.12 + Math.random() * 0.3,
    });

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      motes = Array.from({ length: PARTICLE_COUNT }, seed);
    };

    const frame = () => {
      if (!running) return;
      ctx.clearRect(0, 0, width, height);
      for (const m of motes) {
        m.y -= m.speed;
        m.x += m.drift;
        if (m.y < -4) {
          m.y = height + 4;
          m.x = Math.random() * width;
        }
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 205, 255, ${m.alpha})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };

    const onVisibility = () => {
      running = document.visibilityState === 'visible';
      if (running) {
        raf = requestAnimationFrame(frame);
      } else {
        cancelAnimationFrame(raf);
      }
    };

    resize();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className={styles.layer} aria-hidden="true">
      <div id="cine-tint" className={styles.tint} />
      <canvas ref={canvasRef} className={styles.particles} />
      <div className={styles.grain} />
      <div className={styles.vignette} />
    </div>
  );
}

export default CinematicLayer;
