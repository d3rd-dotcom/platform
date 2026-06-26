'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

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
    return <div className="text-neutral-500 italic">No questions</div>;
  }

  return (
    <div>
      {config.timeLimitMinutes && (
        <p className="text-sm text-neutral-500 mb-3">Time limit: {config.timeLimitMinutes} minutes</p>
      )}

      {questions.map((q, qi) => (
        <div key={q.id} className="mb-4 p-3 rounded border border-neutral-200 dark:border-neutral-700">
          <p className="font-medium mb-2">{qi + 1}. {q.text}</p>
          <div className="space-y-1">
            {q.options.map((opt) => {
              const isSelected = (answers[q.id] ?? []).includes(opt.id);
              let className = 'flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors text-sm';
              if (submitted) {
                if (opt.isCorrect) className += ' border-green-500 bg-green-50 dark:bg-green-900/20';
                else if (isSelected) className += ' border-red-400 bg-red-50 dark:bg-red-900/20';
                else className += ' border-transparent opacity-50';
              } else {
                className += isSelected
                  ? ' border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : ' border-neutral-200 dark:border-neutral-700 hover:border-neutral-400';
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
          className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 text-sm"
        >
          Submit quiz
        </button>
      ) : (
        <div className={`p-3 rounded text-sm ${passed ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'}`}>
          <p className="font-medium">{correctCount}/{total} correct ({percentage}%)</p>
          {passed ? <p>Passed!</p> : <p>Score below passing threshold ({config.passingScore ?? 60}%). Try again.</p>}
        </div>
      )}
    </div>
  );
}
