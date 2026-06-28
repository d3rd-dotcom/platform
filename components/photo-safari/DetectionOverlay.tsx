'use client';

import styles from './DetectionOverlay.module.css';

interface Detection {
  label: string;
  score: number;
  box?: [number, number, number, number];
}

export default function DetectionOverlay({ detections }: { detections: Detection[] }) {
  if (detections.length === 0) return null;

  return (
    <div className={styles.overlay}>
      {detections.map((d, i) => {
        if (!d.box) return null;
        const [left, top, right, bottom] = d.box;
        return (
          <div
            key={i}
            className={styles.box}
            style={{
              left: `${left * 100}%`,
              top: `${top * 100}%`,
              width: `${(right - left) * 100}%`,
              height: `${(bottom - top) * 100}%`,
            }}
          >
            <span className={styles.label}>
              {d.label} <strong>{Math.round(d.score * 100)}</strong>
            </span>
          </div>
        );
      })}
    </div>
  );
}
