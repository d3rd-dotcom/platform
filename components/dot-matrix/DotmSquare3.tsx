'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './DotMatrix.module.css';

const COLS = 6;
const ROWS = 6;
const TOTAL = COLS * ROWS;
const TRAIL = 8;

function computeSpiralOrder(rows: number, cols: number): number[] {
  const order = new Array(rows * cols).fill(0);
  let top = 0, bottom = rows - 1, left = 0, right = cols - 1;
  let step = 0;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) order[top * cols + c] = step++;
    top++;
    for (let r = top; r <= bottom; r++) order[r * cols + right] = step++;
    right--;
    if (top <= bottom) {
      for (let c = right; c >= left; c--) order[bottom * cols + c] = step++;
      bottom--;
    }
    if (left <= right) {
      for (let r = bottom; r >= top; r--) order[r * cols + left] = step++;
      left++;
    }
  }
  return order;
}

const SPIRAL = computeSpiralOrder(ROWS, COLS);

interface Props {
  speed?: number;
  color?: string;
  dotSize?: number;
  gap?: number;
}

export function DotmSquare3({ speed = 1, color, dotSize = 6, gap = 3 }: Props) {
  const [phase, setPhase] = useState(0);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);
  const cycleDuration = 1800 / speed;

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

  const headPos = phase * TOTAL;

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
      {Array.from({ length: TOTAL }, (_, i) => {
        const order = SPIRAL[i];
        const dist = (headPos - order + TOTAL) % TOTAL;
        let opacity: number;
        if (dist < 1) opacity = 1;
        else if (dist < TRAIL) opacity = 0.08 + (1 - dist / TRAIL) * 0.72;
        else opacity = 0.08;
        return <div key={i} className={styles.dot} style={{ opacity }} />;
      })}
    </div>
  );
}
