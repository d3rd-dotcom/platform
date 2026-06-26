'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface MultipleChoiceConfig {
  question?: string;
  options?: Array<{ id: string; text: string; isCorrect: boolean }>;
  allowMultiple?: boolean;
  showFeedback?: boolean;
}

export default function MultipleChoiceRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as MultipleChoiceConfig;
  const options = config.options ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);
  const allowMultiple = config.allowMultiple ?? false;

  const toggle = (id: string) => {
    if (showResults) return;
    setSelected((prev) =>
      allowMultiple
        ? prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
        : [id],
    );
  };

  return (
    <div>
      {config.question && <p className="font-medium mb-2">{config.question}</p>}
      <div className="space-y-1">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          let className = 'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors';
          if (showResults) {
            if (opt.isCorrect) className += ' border-green-500 bg-green-50 dark:bg-green-900/20';
            else if (isSelected) className += ' border-red-400 bg-red-50 dark:bg-red-900/20';
            else className += ' border-neutral-200 dark:border-neutral-700 opacity-60';
          } else {
            className += isSelected
              ? ' border-blue-500 bg-blue-50 dark:bg-blue-900/20'
              : ' border-neutral-200 dark:border-neutral-700 hover:border-neutral-400';
          }
          return (
            <div key={opt.id} className={className} onClick={() => toggle(opt.id)} role="button" tabIndex={0}>
              <span>{allowMultiple ? (isSelected ? '☑' : '□') : (isSelected ? '◉' : '○')}</span>
              <span>{opt.text}</span>
            </div>
          );
        })}
      </div>
      {config.showFeedback && options.length > 0 && (
        <button
          type="button"
          className="mt-2 px-3 py-1 text-sm rounded bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300"
          onClick={() => setShowResults(true)}
        >
          Check answers
        </button>
      )}
    </div>
  );
}
