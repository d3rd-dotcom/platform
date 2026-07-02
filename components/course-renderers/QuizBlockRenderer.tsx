'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './QuizBlockRenderer.module.css';

interface QuizQuestion {
  id: string;
  text: string;
  options: Array<{ id: string; text: string; isCorrect?: boolean }>;
  allowMultiple?: boolean;
}

interface QuizBlockConfig {
  timeLimitMinutes?: number;
  passingScore?: number;
  questions?: QuizQuestion[];
}

interface GradeResult {
  score: number;
  correctCount: number;
  total: number;
  passed: boolean;
  passingScore: number;
  results: Record<string, boolean>;
}

export default function QuizBlockRenderer({
  component,
  grading,
}: {
  component: CourseComponentRecord;
  grading?: { courseId: string; blockId: string };
}) {
  const { getAccessToken } = usePrivy();
  const config = component.config as QuizBlockConfig;
  const questions = config.questions ?? [];
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<GradeResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleAnswer = (qId: string, optId: string, allowMultiple: boolean) => {
    if (result) return;
    setAnswers((prev) => {
      const current = prev[qId] ?? [];
      if (allowMultiple) {
        return { ...prev, [qId]: current.includes(optId) ? current.filter((a) => a !== optId) : [...current, optId] };
      }
      return { ...prev, [qId]: [optId] };
    });
  };

  // Preview fallback (builder) — the config still carries the answer key there.
  const gradeLocally = (): GradeResult => {
    const results: Record<string, boolean> = {};
    let correctCount = 0;
    for (const q of questions) {
      const selected = [...(answers[q.id] ?? [])].sort();
      const correct = q.options.filter((o) => o.isCorrect).map((o) => o.id).sort();
      const ok = correct.length > 0
        && selected.length === correct.length
        && selected.every((v, i) => v === correct[i]);
      results[q.id] = ok;
      if (ok) correctCount++;
    }
    const total = questions.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passingScore = config.passingScore ?? 60;
    return { score, correctCount, total, passed: score >= passingScore, passingScore, results };
  };

  const handleSubmit = async () => {
    setError(null);
    if (!grading) {
      setResult(gradeLocally());
      return;
    }
    setSubmitting(true);
    try {
      const token = await getAccessToken();
      const res = await fetch(`/api/vip/courses/${grading.courseId}/quiz-grade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ blockId: grading.blockId, answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? 'Failed to grade the quiz');
      setResult(data as GradeResult);
    } catch (err: any) {
      setError(err.message ?? 'Failed to grade the quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setAnswers({});
    setError(null);
  };

  if (questions.length === 0) {
    return <div className={styles.empty_state}>No questions</div>;
  }

  const allAnswered = questions.every((q) => (answers[q.id] ?? []).length > 0);

  return (
    <div>
      {config.timeLimitMinutes ? (
        <p className={styles.time_limit}>Time limit: {config.timeLimitMinutes} minutes</p>
      ) : null}

      {questions.map((q, qi) => {
        const questionCorrect = result?.results?.[q.id];
        return (
          <div key={q.id} className={styles.question_card}>
            <p className={styles.question_text}>{qi + 1}. {q.text}</p>
            <div className={styles.options_list}>
              {q.options.map((opt) => {
                const isSelected = (answers[q.id] ?? []).includes(opt.id);
                let className = styles.option;
                if (result) {
                  if (isSelected) {
                    className += ' ' + (questionCorrect ? styles.option_correct : styles.option_incorrect);
                  } else {
                    className += ' ' + styles.option_disabled;
                  }
                } else if (isSelected) {
                  className += ' ' + styles.option_selected;
                }
                return (
                  <div
                    key={opt.id}
                    className={className}
                    onClick={() => toggleAnswer(q.id, opt.id, q.allowMultiple ?? false)}
                    role="button"
                    tabIndex={0}
                  >
                    <span>{q.allowMultiple ? (isSelected ? '☑' : '□') : (isSelected ? '◉' : '○')}</span>
                    <span>{opt.text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {error && <p className={styles.time_limit}>{error}</p>}

      {!result ? (
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !allAnswered}
          className={styles.submit_btn}
        >
          {submitting ? 'Grading...' : allAnswered ? 'Submit quiz' : 'Answer every question'}
        </button>
      ) : (
        <div className={`${styles.result_card} ${result.passed ? styles.result_passed : styles.result_failed}`}>
          <p className={styles.result_title}>{result.correctCount}/{result.total} correct ({result.score}%)</p>
          {result.passed ? (
            <p>Passed!</p>
          ) : (
            <>
              <p>Score below passing threshold ({result.passingScore}%).</p>
              <button type="button" onClick={handleRetry} className={styles.submit_btn}>
                Try again
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
