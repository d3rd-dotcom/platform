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

// ── Voice-note recorder ─────────────────────────────────────
interface VoiceDumpFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function VoiceDumpField({ value, onChange }: VoiceDumpFieldProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => () => {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size === 0) {
          setStatus('idle');
          return;
        }
        setStatus('transcribing');
        try {
          const fd = new FormData();
          fd.append('audio', blob, 'recording.webm');
          const res = await fetch('/api/voice/transcribe', { method: 'POST', body: fd });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.text) {
            const existing = valueRef.current.trim();
            onChange(existing ? `${existing} ${data.text}` : data.text);
          } else if (data?.error === 'transcription_unconfigured') {
            setError('Voice transcription isn’t set up — you can type below instead.');
          } else {
            setError('Could not transcribe that — try again, or type below.');
          }
        } catch {
          setError('Could not transcribe that — try again, or type below.');
        }
        setStatus('idle');
      };

      recorder.start();
      recorderRef.current = recorder;
      setStatus('recording');
    } catch {
      setError('Microphone access was blocked — you can type below instead.');
      setStatus('idle');
    }
  }, [onChange]);

  const stopRecording = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
  }, []);

  return (
    <div className={styles.voiceDump}>
      <button
        type="button"
        className={`${styles.recordBtn} ${status === 'recording' ? styles.recordBtnActive : ''}`}
        onClick={status === 'recording' ? stopRecording : startRecording}
        disabled={status === 'transcribing'}
      >
        {status === 'recording' ? (
          <>
            <span className={styles.recDot} aria-hidden="true" />
            Stop recording
          </>
        ) : status === 'transcribing' ? (
          <>
            <span className={styles.recSpinner} aria-hidden="true" />
            Transcribing…
          </>
        ) : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
            </svg>
            Record a voice note
          </>
        )}
      </button>

      {error && <p className={styles.voiceError}>{error}</p>}

      <textarea
        className={styles.textInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Record a voice note, or type here…"
        rows={6}
      />
    </div>
  );
}

export default function CourseIntake({ initialAnswers = {}, onComplete }: CourseIntakeProps) {
  const { play } = useSound();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [stepIndex, setStepIndex] = useState(() => firstUnansweredIndex(initialAnswers));
  const [choice, setChoice] = useState<string | null>(null);
  const [textValue, setTextValue] = useState('');

  const ttsAbortRef = useRef<AbortController | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const spokenStepRef = useRef<number>(-1);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const question = INTAKE_QUESTIONS[stepIndex];
  const total = INTAKE_QUESTIONS.length;
  const isLast = stepIndex === total - 1;

  // Restore any previously given answer when the question changes.
  useEffect(() => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    const saved = answers[question.key];
    const matchedChoice = saved && question.choices?.some((c) => c.value === saved);
    setChoice(matchedChoice ? saved : null);
    setTextValue(saved && !matchedChoice ? saved : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  // Speak Blue's line — exactly once per question, cancelling anything prior.
  const speak = useCallback(async (text: string, step: number) => {
    ttsAbortRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const controller = new AbortController();
    ttsAbortRef.current = controller;
    try {
      const res = await fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      });
      if (!res.ok || controller.signal.aborted) return;
      const { audio } = await res.json();
      if (!audio || controller.signal.aborted) return;
      const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
      const el = new Audio(url);
      el.onended = () => URL.revokeObjectURL(url);
      audioRef.current = el;
      await el.play();
      spokenStepRef.current = step;
    } catch {
      // Aborted, autoplay-blocked, or TTS unavailable — narration is best-effort.
    }
  }, []);

  // Narrate the active question.
  useEffect(() => {
    speak(question.blueText, stepIndex);
    return () => ttsAbortRef.current?.abort();
  }, [stepIndex, question.blueText, speak]);

  // If the intro was autoplay-blocked, the first interaction unlocks + replays it.
  useEffect(() => {
    const handler = () => {
      if (spokenStepRef.current !== stepIndex) {
        speak(question.blueText, stepIndex);
      }
    };
    window.addEventListener('pointerdown', handler, { once: true });
    return () => window.removeEventListener('pointerdown', handler);
  }, [stepIndex, question.blueText, speak]);

  const persist = useCallback((next: Record<string, string>) => {
    fetch('/api/course/intake', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers: next }),
    }).catch(() => {/* progressive save is best-effort */});
  }, []);

  const hasAnswer = Boolean(choice) || Boolean(textValue.trim());
  const canContinue = hasAnswer || Boolean(question.optional);

  const commitAndAdvance = useCallback((value: string) => {
    let next = answers;
    if (value) {
      next = { ...answers, [question.key]: value };
      setAnswers(next);
      persist(next);
    }
    if (isLast) {
      ttsAbortRef.current?.abort();
      audioRef.current?.pause();
      onComplete(next);
    } else {
      setStepIndex((s) => s + 1);
    }
  }, [answers, isLast, onComplete, persist, question.key]);

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    commitAndAdvance(textValue.trim() || choice || '');
  }, [canContinue, choice, textValue, commitAndAdvance]);

  // Picking a choice auto-advances after a short beat so the selection shows.
  const selectChoice = useCallback((value: string) => {
    play('click');
    setChoice(value);
    setTextValue('');
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    autoAdvanceRef.current = setTimeout(() => {
      autoAdvanceRef.current = null;
      commitAndAdvance(value);
    }, 280);
  }, [commitAndAdvance, play]);

  useEffect(() => () => {
    if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
  }, []);

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
              <span className={styles.stepCount}>Question {stepIndex + 1} of {total}</span>
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
                        onClick={() => selectChoice(c.value)}
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

              {question.voiceDump ? (
                <VoiceDumpField value={textValue} onChange={setTextValue} />
              ) : (
                question.allowText && (
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
                )
              )}
            </div>

            <div className={styles.controls}>
              <button
                type="button"
                className={styles.backBtn}
                onClick={() => {
                  play('click');
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
