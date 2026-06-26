'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './TextInputRenderer.module.css';

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
          className={styles.input}
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
          className={styles.input}
        />
      )}
    </div>
  );
}
