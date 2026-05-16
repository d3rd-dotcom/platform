'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { INTAKE_QUESTIONS } from './intakeQuestions';
import { useSound } from '@/hooks/useSound';
import styles from './CourseIntake.module.css';

interface CourseIntakeProps {
  initialAnswers?: Record<string, string>;
  onComplete: (answers: Record<string, string>) => void;
}

function firstUnansweredIndex(answers: Record<string, string>): number {
  const idx = INTAKE_QUESTIONS.findIndex((q) => !answers[q.key]);
  return idx === -1 ? INTAKE_QUESTIONS.length - 1 : idx;
}

async function speakBlue(text: string, signal?: AbortSignal): Promise<void> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error('TTS request failed');

  const { audio } = await res.json();
  if (!audio) throw new Error('No audio data');

  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);

  return new Promise<void>((resolve, reject) => {
    const el = new Audio(url);
    el.onended = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Audio playback error'));
    };
    el.play().catch((error) => {
      URL.revokeObjectURL(url);
      reject(error);
    });
  });
}

export default function CourseIntake({ initialAnswers = {}, onComplete }: CourseIntakeProps) {
  const { play } = useSound();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(() => firstUnansweredIndex(initialAnswers));
  const [choice, setChoice] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');
  const speechAbortRef = useRef<AbortController | null>(null);
  const speechReadyRef = useRef(false);
  const spokenQuestionRef = useRef<string | null>(null);

  const question = INTAKE_QUESTIONS[stepIndex];
  const total = INTAKE_QUESTIONS.length;
  const isLast = stepIndex === total - 1;

  // Restore any previously given answer when the question changes.
  useEffect(() => {
    const saved = answers[question.key];
    const matchedChoice = saved && question.choices?.some((c) => c.value === saved);
    setChoice(matchedChoice ? saved : null);
    setTextValue(saved && !matchedChoice ? saved : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  useEffect(() => {
    if (!speechReadyRef.current) return;
    if (spokenQuestionRef.current === question.key) return;

    spokenQuestionRef.current = question.key;
    speechAbortRef.current?.abort();
    const controller = new AbortController();
    speechAbortRef.current = controller;

    speakBlue(question.blueText, controller.signal).catch(() => {
      // Narration is best-effort.
    });

    return () => controller.abort();
  }, [question.blueText, question.key]);

  const persist = useCallback((next: Record<string, string>) => {
    fetch('/api/course/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: next }),
    }).catch(() => {/* progressive save is best-effort */});
  }, []);

  const hasAnswer = Boolean(choice) || Boolean(textValue.trim());
  const canContinue = hasAnswer || Boolean(question.optional);

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    speechReadyRef.current = true;
    const value = textValue.trim() || choice || '';
    let next = answers;
    if (value) {
      next = { ...answers, [question.key]: value };
      setAnswers(next);
      persist(next);
    }
    if (isLast) {
      onComplete(next);
    } else {
      spokenQuestionRef.current = null;
      setStepIndex((s) => s + 1);
    }
  }, [answers, canContinue, choice, isLast, onComplete, persist, question.key, textValue]);

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.videoStage}>
          <video
            className={styles.video}
            src="/videos/bluehome.mp4"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-hidden="true"
          />
          <div className={styles.scrim} aria-hidden="true" />
          <div className={styles.overlay}>
            <div className={styles.questionWrap} key={stepIndex}>
              <h2 className={styles.question}>{question.blueText}</h2>

              {question.choices && (
                <div className={styles.options} role="radiogroup" aria-label={question.label}>
                  {question.choices.map((c) => {
                    const active = choice === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        className={`${styles.option} ${active ? styles.optionActive : ''}`}
                        onClick={() => {
                          play('click');
                          if (!speechReadyRef.current) {
                            speechReadyRef.current = true;
                            void speakBlue(question.blueText).catch(() => {});
                          }
                          setChoice(c.value);
                          setTextValue('');
                        }}
                        onMouseEnter={() => play('hover')}
                      >
                        <span className={styles.radio}>
                          <span className={styles.radioDot} />
                        </span>
                        <span className={styles.optionLabel}>{c.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {question.allowText && (
                <div className={styles.textBlock}>
                  <textarea
                    className={styles.textInput}
                    value={textValue}
                    onChange={(e) => {
                      setTextValue(e.target.value);
                      if (e.target.value) setChoice(null);
                    }}
                    onKeyDown={(e) => {
                      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleContinue();
                    }}
                    placeholder={question.textPlaceholder ?? 'Type your answer…'}
                    rows={question.choices ? 2 : 4}
                  />
                </div>
              )}
            </div>

            <div className={styles.controls}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  play('click');
                  spokenQuestionRef.current = null;
                  setStepIndex((s) => Math.max(0, s - 1));
                }}
                onMouseEnter={() => play('hover')}
                disabled={stepIndex === 0}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.continueBtn}
                onClick={handleContinue}
                onMouseEnter={() => play('hover')}
                disabled={!canContinue}
              >
                {isLast ? 'Build my course' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
