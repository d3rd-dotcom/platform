'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './QuizBlockRenderer.module.css';

interface QuizQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
  allowMultiple?: boolean;
}

interface QuizBlockConfig {
  timeLimitMinutes?: number;
  passingScore?: number;
  questions?: QuizQuestion[];
}

export default function QuizBlockRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as QuizBlockConfig;
  const questions = config.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [submitted, setSubmitted] = useState(false);

  const toggleAnswer = (qId: string, optId: string, allowMultiple: boolean) => {
    if (submitted) return;
    setAnswers((prev) => {
      const current = prev[qId] ?? [];
      if (allowMultiple) {
        return { ...prev, [qId]: current.includes(optId) ? current.filter((a) => a !== optId) : [...current, optId] };
      }
      return { ...prev, [qId]: [optId] };
    });
  };

  const handleSubmit = () => {
    setSubmitted(true);
  };

  const correctCount = submitted
    ? questions.filter((q) => {
        const userAnswer = answers[q.id] ?? [];
        const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
        return JSON.stringify(userAnswer.sort()) === JSON.stringify(correct);
      }).length
    : 0;

  const total = questions.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = config.passingScore ? percentage >= config.passingScore : percentage >= 60;

  if (questions.length === 0) {
    return <div className={styles.empty_state}>No questions</div>;
  }

  return (
    <div>
      {config.timeLimitMinutes && (
        <p className={styles.time_limit}>Time limit: {config.timeLimitMinutes} minutes</p>
      )}

      {questions.map((q, qi) => (
        <div key={q.id} className={styles.question_card}>
          <p className={styles.question_text}>{qi + 1}. {q.text}</p>
          <div className={styles.options_list}>
            {q.options.map((opt) => {
              const isSelected = (answers[q.id] ?? []).includes(opt.id);
              let className = styles.option;
              if (submitted) {
                if (opt.isCorrect) className += ' ' + styles.option_correct;
                else if (isSelected) className += ' ' + styles.option_incorrect;
                else className += ' ' + styles.option_disabled;
              } else if (isSelected) {
                className += ' ' + styles.option_selected;
              }
              return (
                <div key={opt.id} className={className} onClick={() => toggleAnswer(q.id, opt.id, q.allowMultiple ?? false)} role="button" tabIndex={0}>
                  <span>{q.allowMultiple ? (isSelected ? '☑' : '□') : (isSelected ? '◉' : '○')}</span>
                  <span>{opt.text}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {!submitted ? (
        <button
          type="button"
          onClick={handleSubmit}
          className={styles.submit_btn}
        >
          Submit quiz
        </button>
      ) : (
        <div className={`${styles.result_card} ${passed ? styles.result_passed : styles.result_failed}`}>
          <p className={styles.result_title}>{correctCount}/{total} correct ({percentage}%)</p>
          {passed ? <p>Passed!</p> : <p>Score below passing threshold ({config.passingScore ?? 60}%). Try again.</p>}
        </div>
      )}
    </div>
  );
}
