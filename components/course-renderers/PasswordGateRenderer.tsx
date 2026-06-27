'use client';

import { useState } from 'react';
import { Lock, LockOpen } from '@phosphor-icons/react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './PasswordGateRenderer.module.css';

interface PasswordGateConfig {
  password?: string;
  hint?: string;
  content?: string;
}

export default function PasswordGateRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as PasswordGateConfig;
  const [input, setInput] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!config.password) {
      setUnlocked(true);
      return;
    }
    if (input === config.password) {
      setUnlocked(true);
      setError('');
    } else {
      setError('Incorrect password. Try again.');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  if (unlocked) {
    return (
      <div className={`${styles.gate} ${styles.gateUnlocked}`}>
        <div className={`${styles.lockIcon} ${styles.lockIconUnlocked}`}>
          <LockOpen size={22} weight="bold" />
        </div>
        <p style={{ fontWeight: 600, margin: 0, fontSize: '0.875rem', color: '#22c55e' }}>Unlocked</p>
        {config.content && <div className={styles.unlockedContent}>{config.content}</div>}
      </div>
    );
  }

  return (
    <div className={styles.gate}>
      <div className={styles.lockIcon}>
        <Lock size={22} weight="bold" />
      </div>
      {config.hint && <p className={styles.hint}>{config.hint}</p>}
      <div className={styles.inputRow}>
        <input
          type="text"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={handleKeyDown}
          placeholder="Enter password"
          className={styles.input}
          autoComplete="off"
        />
        <button type="button" onClick={handleSubmit} className={styles.submitBtn}>Unlock</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
