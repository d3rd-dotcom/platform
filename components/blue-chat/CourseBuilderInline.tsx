'use client';

import React, { useState } from 'react';
import styles from './BlueChat.module.css';
import type { CourseData } from '@/lib/personal-course';
import type { SoundType } from '@/lib/sound-engine';

interface CourseBuilderInlineProps {
  authHeaders: () => Promise<HeadersInit>;
  onPlay?: (sound: SoundType) => void;
  onClose: () => void;
  onCourseCreated: () => void;
}

type Phase = 'collect' | 'generating' | 'preview' | 'saving';

const CourseBuilderInline: React.FC<CourseBuilderInlineProps> = ({
  authHeaders,
  onPlay,
  onClose,
  onCourseCreated,
}) => {
  const [phase, setPhase] = useState<Phase>('collect');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [course, setCourse] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draft = async () => {
    if (!topic.trim()) {
      setError('Give Blue a topic to work with.');
      return;
    }
    onPlay?.('click');
    setError(null);
    setPhase('generating');
    try {
      const prompt = `Topic: ${topic.trim()}${goal.trim() ? `\nGoal: ${goal.trim()}` : ''}`;
      const res = await fetch('/api/course/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json().catch(() => ({})) as { course?: CourseData; error?: string };
      if (!res.ok || !data.course) {
        setError(data.error ?? 'Generation failed. Try again.');
        setPhase('collect');
        return;
      }
      setCourse(data.course);
      setPhase('preview');
    } catch {
      setError('Something went wrong. Try again.');
      setPhase('collect');
    }
  };

  const save = async () => {
    if (!course) return;
    onPlay?.('click');
    setPhase('saving');
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/course/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        credentials: 'include',
        body: JSON.stringify({ courseData: course }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Could not save the course. Try again.');
        setPhase('preview');
        return;
      }
      onPlay?.('success');
      onCourseCreated();
    } catch {
      setError('Something went wrong saving the course.');
      setPhase('preview');
    }
  };

  return (
    <div className={styles.courseBuilderPanel}>
      <div className={styles.autoDistributionHeader}>
        <span className={styles.autoDistributionTitle}>Course builder</span>
        <button
          type="button"
          className={styles.autoDistributionMinimizeBtn}
          onClick={() => { onPlay?.('click'); onClose(); }}
          aria-label="Close course builder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {phase === 'collect' && (
        <>
          <p className={styles.courseBuilderDesc}>
            Tell me what you want to learn and I&apos;ll design a 4-week course around it.
          </p>
          <div className={styles.autoDistributionSection}>
            <span className={styles.autoDistributionLabel}>Topic</span>
            <input
              className={styles.questForgeInput}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') draft(); }}
              placeholder="e.g. drawing, public speaking, morning routine"
              maxLength={120}
            />
          </div>
          <div className={styles.autoDistributionSection}>
            <span className={styles.autoDistributionLabel}>Goal (optional)</span>
            <input
              className={styles.questForgeInput}
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') draft(); }}
              placeholder="e.g. sketch daily, speak confidently in meetings"
              maxLength={200}
            />
          </div>
          {error && <div className={styles.questForgeError}>{error}</div>}
          <div className={styles.autoDistributionFooter}>
            <div className={styles.autoDistributionButtons}>
              <button type="button" className={styles.inlineFormCancel} onClick={() => { onPlay?.('click'); onClose(); }}>Close</button>
              <button type="button" className={styles.inlineFormProceed} onClick={draft} disabled={!topic.trim()}>
                Draft course
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'generating' && (
        <p className={styles.courseBuilderDesc} style={{ padding: '8px 0' }}>
          Generating your course...
        </p>
      )}

      {(phase === 'preview' || phase === 'saving') && course && (
        <>
          <div className={styles.autoDistributionSection}>
            <span className={styles.autoDistributionLabel}>Course title</span>
            <p className={styles.courseBuilderTitle}>{course.title}</p>
          </div>
          <div className={styles.autoDistributionSection}>
            <span className={styles.autoDistributionLabel}>4 weeks</span>
            <div className={styles.courseBuilderWeeks}>
              {course.weeks.map((w) => (
                <div key={w.weekNumber} className={styles.courseBuilderWeek}>
                  <span className={styles.courseBuilderWeekLabel}>Week {w.weekNumber} — {w.theme}</span>
                  <ul className={styles.courseBuilderTasks}>
                    {w.tasks.map((t, i) => (
                      <li key={i}>{t}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className={styles.courseBuilderWarning}>
            AI-generated — treat this as a starting framework, not a certified curriculum.
          </div>
          {error && <div className={styles.questForgeError}>{error}</div>}
          <div className={styles.autoDistributionFooter}>
            <div className={styles.autoDistributionButtons}>
              <button
                type="button"
                className={styles.inlineFormCancel}
                onClick={() => { onPlay?.('click'); setPhase('collect'); setCourse(null); }}
                disabled={phase === 'saving'}
              >
                Back
              </button>
              <button
                type="button"
                className={styles.inlineFormProceed}
                onClick={save}
                disabled={phase === 'saving'}
              >
                {phase === 'saving' ? 'Creating...' : 'Create course'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CourseBuilderInline;
