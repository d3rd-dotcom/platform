'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './DotMatrix.module.css';

const COLS = 6;
const ROWS = 6;
const LOOPS = 2;
const BASE = 0.08;
const STRAND = 1;
const BRIDGE = 0.58;
const NEAR = 0.24;

interface Props {
  speed?: number;
  color?: string;
  dotSize?: number;
  gap?: number;
}

export function DotmSquare15({ speed = 1, color, dotSize = 6, gap = 3 }: Props) {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const cycleDuration = 1600 / speed;

  useEffect(() => {
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      setPhase((elapsed % cycleDuration) / cycleDuration);
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [cycleDuration]);

  return (
    <div
      className={styles.grid}
      style={{
        '--cols': COLS,
        '--dot-size': `${dotSize}px`,
        '--dot-gap': `${gap}px`,
        ...(color ? { '--dot-color': color } : {}),
      } as React.CSSProperties}
      aria-hidden="true"
    >
      {Array.from({ length: ROWS * COLS }, (_, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const rowPhase = phase * LOOPS * 2 * Math.PI + row * 1.24;
        const left = Math.round(1 + Math.sin(rowPhase));
        const right = 4 - left;
        const bridgeOn = Math.cos(rowPhase * 2) > 0.82;

        let opacity = BASE;
        if (col === left || col === right) opacity = STRAND;
        else if (bridgeOn && col > left && col < right) opacity = BRIDGE;
        else if (Math.abs(col - left) === 1 || Math.abs(col - right) === 1) opacity = NEAR;

        return <div key={i} className={styles.dot} style={{ opacity }} />;
      })}
    </div>
  );
}
