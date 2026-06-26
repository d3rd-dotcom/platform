'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface RatingScaleConfig {
  min?: number;
  max?: number;
  step?: number;
  labels?: Record<number, string>;
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
      <div className="flex items-center gap-1">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
              value === v
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
            onClick={() => setValue(v)}
          >
            {v}
          </button>
        ))}
      </div>
      {value !== null && config.labels?.[value] && (
        <p className="text-sm text-neutral-500 mt-1">{config.labels[value]}</p>
      )}
    </div>
  );
}
