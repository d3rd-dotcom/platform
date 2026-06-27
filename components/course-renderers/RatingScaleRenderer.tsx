'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './RatingScaleRenderer.module.css';

interface RatingScaleConfig {
  min?: number;
  max?: number;
  step?: number;
  labels?: Record<number, string>;
  minLabel?: string;
  maxLabel?: string;
}

export default function RatingScaleRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as RatingScaleConfig;
  const min = config.min ?? 1;
  const max = config.max ?? 5;
  const [value, setValue] = useState<number | null>(null);

  const values: number[] = [];
  for (let v = min; v <= max; v += config.step ?? 1) {
    values.push(v);
  }

  return (
    <div>
      <div className={styles.rating_container}>
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`${styles.rating_btn} ${value === v ? styles.rating_btn_active : styles.rating_btn_inactive}`}
            onClick={() => setValue(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {value !== null && config.labels?.[value] && (
        <p className={styles.label_text}>{config.labels[value]}</p>
      )}
      {value === null && (config.minLabel || config.maxLabel) && (
        <p className={styles.label_text}>
          {config.minLabel}{config.minLabel && config.maxLabel ? ' — ' : ''}{config.maxLabel}
        </p>
      )}
    </div>
  );
}
