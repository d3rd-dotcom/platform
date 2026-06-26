'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './MultipleChoiceRenderer.module.css';

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
      {config.question && <p className={styles.question_text}>{config.question}</p>}
      <div className={styles.options_list}>
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          let className = styles.option;
          if (showResults) {
            if (opt.isCorrect) className += ' ' + styles.option_correct;
            else if (isSelected) className += ' ' + styles.option_incorrect;
            else className += ' ' + styles.option_disabled;
          } else {
            className += isSelected
              ? ' ' + styles.option_selected
              : ' ' + styles.option_unselected;
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
          className={styles.submit_btn}
          onClick={() => setShowResults(true)}
        >
          Check answers
        </button>
      )}
    </div>
  );
}
