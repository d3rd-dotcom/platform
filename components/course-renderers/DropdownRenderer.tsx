'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './DropdownRenderer.module.css';

interface DropdownConfig {
  label?: string;
  options?: Array<{ id: string; value: string; displayText: string }>;
  placeholder?: string;
  required?: boolean;
}

export default function DropdownRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as DropdownConfig;
  const options = config.options ?? [];
  const [value, setValue] = useState('');

  return (
    <div>
      {config.label && <label className={styles.label}>{config.label}</label>}
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={styles.select}
        required={config.required}
      >
        <option value="" disabled>{config.placeholder ?? 'Select...'}</option>
        {options.map((opt) => (
          <option key={opt.id} value={opt.value}>{opt.displayText}</option>
        ))}
      </select>
    </div>
  );
}
