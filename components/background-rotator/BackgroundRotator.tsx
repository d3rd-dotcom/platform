'use client';

import { useState, useEffect } from 'react';
import styles from './BackgroundRotator.module.css';

const TOTAL = 21;

function getIndex(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const day = Math.floor(diff / (1000 * 60 * 60 * 24));
  return (day % TOTAL) + 1;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function BackgroundRotator() {
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const idx = getIndex();
    setIndex(idx);

    const img = new Image();
    img.src = `/backgrounds/bg-${pad(idx)}.png`;
    img.onload = () => setLoaded(true);
  }, []);

  if (index === 0) return null;

  return (
    <div className={styles.wrapper} data-loaded={loaded}>
      <div
        className={styles.image}
        style={{ backgroundImage: `url(/backgrounds/bg-${pad(index)}.png)` }}
      />
      <div className={styles.overlay} />
      <span className={styles.badge}>BG {index}/{TOTAL}</span>
    </div>
  );
}
