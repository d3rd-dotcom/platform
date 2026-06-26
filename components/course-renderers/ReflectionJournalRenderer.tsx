'use client';

import { useState, useEffect, useRef } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ReflectionJournalRenderer.module.css';

interface ReflectionJournalConfig {
  prompt?: string;
  minWords?: number;
  saveEnabled?: boolean;
}

export default function ReflectionJournalRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as ReflectionJournalConfig;
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const minWords = config.minWords ?? 0;
  const meetsMin = wordCount >= minWords;

  useEffect(() => {
    if (!config.saveEnabled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }, 1500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [text, config.saveEnabled]);

  return (
    <div>
      {config.prompt && <p className={styles.prompt}>{config.prompt}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={styles.textarea}
        placeholder="Write your reflection..."
      />
      <div className={styles.footer}>
        <span className={!meetsMin && text.length > 0 ? styles.word_count_warning : ''}>
          {wordCount} / {minWords} words {minWords > 0 && (meetsMin ? '✓' : '(minimum)')}
        </span>
        {saved && <span className={styles.saved_text}>Saved</span>}
      </div>
    </div>
  );
}
