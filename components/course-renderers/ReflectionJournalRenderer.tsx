'use client';

import { useState, useEffect, useRef } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

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
      {config.prompt && <p className="font-medium mb-2">{config.prompt}</p>}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="w-full p-3 rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 min-h-[120px] resize-y"
        placeholder="Write your reflection..."
      />
      <div className="flex items-center justify-between mt-1 text-sm text-neutral-500">
        <span className={!meetsMin && text.length > 0 ? 'text-amber-500' : ''}>
          {wordCount} / {minWords} words {minWords > 0 && (meetsMin ? '✓' : '(minimum)')}
        </span>
        {saved && <span className="text-green-500">Saved</span>}
      </div>
    </div>
  );
}
