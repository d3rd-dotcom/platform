'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface TextInputConfig {
  placeholder?: string;
  maxLength?: number;
  inputType?: 'text' | 'email' | 'number';
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export default function TextInputRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as TextInputConfig;
  const [value, setValue] = useState('');
  const type = config.inputType ?? 'text';
  const maxLength = config.maxLength ?? 500;

  return (
    <div>
      {type === 'text' || type === 'email' ? (
        <input
          type={type}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder}
          maxLength={maxLength}
          required={config.validation?.required}
          pattern={config.validation?.pattern}
          className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        />
      ) : (
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={config.placeholder}
          min={config.validation?.min}
          max={config.validation?.max}
          required={config.validation?.required}
          className="w-full p-2 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        />
      )}
    </div>
  );
}
