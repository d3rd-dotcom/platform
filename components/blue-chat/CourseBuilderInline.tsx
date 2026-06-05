'use client';

import React, { useState } from 'react';
import styles from './BlueChat.module.css';
import type { CourseData } from '@/lib/personal-course';

interface CourseBuilderInlineProps {
  authHeaders: () => Promise<HeadersInit>;
  onClose: () => void;
  onCourseCreated: () => void;
}

type Phase = 'collect' | 'generating' | 'preview' | 'saving';

const CourseBuilderInline: React.FC<CourseBuilderInlineProps> = ({
  authHeaders,
  onClose,
  onCourseCreated,
}) => {
  const [phase, setPhase] = useState<Phase>('collect');
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [course, setCourse] = useState<CourseData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const draft = async () => {
    if (!topic.trim()) {
      setError('Give Blue a topic to work with.');
      return;
    }
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
      onCourseCreated();
    } catch {
      setError('Something went wrong saving the course.');
      setPhase('preview');
    }
  };

  if (isMinimized) {
    return (
      <div className={styles.autoDistributionMinimizedChip}>
        <span className={styles.autoDistributionTitle}>Course builder</span>
        <button
          type="button"
          className={styles.autoDistributionMinimizeBtn}
          onClick={() => setIsMinimized(false)}
          aria-label="Expand course builder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.autoDistributionPanel}>
      <div className={styles.autoDistributionHeader}>
        <span className={styles.autoDistributionTitle}>Course builder</span>
        <button
          type="button"
          className={styles.autoDistributionMinimizeBtn}
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize course builder"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>

      {phase === 'collect' && (
        <>
          <p className={styles.autoDistributionDesc}>
            Tell me what you want to learn and I&apos;ll design a 4-week course around it.
          </p>
          <div className={styles.autoDistributionSection}>
            <span className={styles.autoDistributionLabel}>Topic</span>
            <input
              className={styles.questForgeInput}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
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
              placeholder="e.g. sketch daily, speak confidently in meetings"
              maxLength={200}
            />
          </div>
          {error && <div className={styles.questForgeError}>{error}</div>}
          <div className={styles.autoDistributionFooter}>
            <div className={styles.autoDistributionButtons}>
              <button type="button" className={styles.inlineFormCancel} onClick={onClose}>Close</button>
              <button type="button" className={styles.inlineFormProceed} onClick={draft} disabled={!topic.trim()}>
                Draft course
              </button>
            </div>
          </div>
        </>
      )}

      {phase === 'generating' && (
        <p className={styles.autoDistributionDesc} style={{ padding: '12px 0' }}>
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
            AI-generated courses may have gaps or errors. Use this as a starting framework, not a certified curriculum.
          </div>
          {error && <div className={styles.questForgeError}>{error}</div>}
          <div className={styles.autoDistributionFooter}>
            <div className={styles.autoDistributionButtons}>
              <button
                type="button"
                className={styles.inlineFormCancel}
                onClick={() => { setPhase('collect'); setCourse(null); }}
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
