'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import { useSound } from '@/hooks/useSound';
import type { CourseData } from '@/lib/personal-course';
import shared from '../page.module.css';
import styles from './personal.module.css';

type ProgressMap = Record<string, number[]>;

function paragraphs(body: string): string[] {
  return body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
}

export default function PersonalCoursePage() {
  const { ready, getAccessToken } = usePrivy();
  const { play } = useSound();

  const [loading, setLoading] = useState(true);
  const [persisted, setPersisted] = useState(false);
  const [course, setCourse] = useState<CourseData | null>(null);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [viewWeek, setViewWeek] = useState(1);
  const [readingOpen, setReadingOpen] = useState(false);
  const [swipeAnim, setSwipeAnim] = useState<'none' | 'left' | 'right'>('none');

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        const res = await fetch('/api/course/personal', {
          cache: 'no-store',
          headers: await authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        const record = data?.course;
        if (record?.status === 'ready' && record?.courseData?.weeks?.length) {
          setCourse(record.courseData as CourseData);
          setProgress((record.progressData as ProgressMap) ?? {});
          setPersisted(Boolean(record && !data.guest));
        } else {
          setCourse(null);
        }
      } catch {
        setCourse(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, authHeaders]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistProgress = useCallback((next: ProgressMap) => {
    if (!persisted) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch('/api/course/progress', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
          body: JSON.stringify({ progress: next }),
        });
      } catch {
        // Progress is best-effort; a failed save just isn't persisted.
      }
    }, 600);
  }, [persisted, authHeaders]);

  const totalWeeks = course?.weeks.length ?? 4;
  const week = course?.weeks.find((w) => w.weekNumber === viewWeek) ?? course?.weeks[0];

  const toggleTask = (taskIndex: number) => {
    if (!week) return;
    play('click');
    const key = `week${week.weekNumber}`;
    setProgress((prev) => {
      const done = new Set(prev[key] ?? []);
      if (done.has(taskIndex)) done.delete(taskIndex);
      else done.add(taskIndex);
      const next = { ...prev, [key]: Array.from(done).sort((a, b) => a - b) };
      persistProgress(next);
      return next;
    });
  };

  const goToWeek = (dir: 'prev' | 'next') => {
    setViewWeek((w) => {
      if (dir === 'next' && w < totalWeeks) { setSwipeAnim('left'); play('click'); return w + 1; }
      if (dir === 'prev' && w > 1) { setSwipeAnim('right'); play('click'); return w - 1; }
      return w;
    });
    setReadingOpen(false);
    setTimeout(() => setSwipeAnim('none'), 160);
  };

  if (loading) {
    return (
      <div className={shared.pageLayout}>
        <SideNavigation />
        <main className={shared.content}>
          <div className={styles.stateWrap}><p className={styles.stateText}>Loading your course…</p></div>
        </main>
      </div>
    );
  }

  if (!course || !week) {
    return (
      <div className={shared.pageLayout}>
        <SideNavigation />
        <main className={shared.content}>
          <div className={styles.stateWrap}>
            <h1 className={styles.stateHeading}>No personal course yet</h1>
            <p className={styles.stateText}>
              Build a 4-week course with Blue, then it&apos;ll show up here.
            </p>
            <Link href="/courses" className={styles.stateBtn}>Back to courses</Link>
          </div>
        </main>
      </div>
    );
  }

  const completedThisWeek = (progress[`week${week.weekNumber}`] ?? []).length;

  return (
    <div className={shared.pageLayout}>
      <SideNavigation />
      <main className={shared.content}>
        <div className={shared.leftCol}>

          <div className={styles.courseHead}>
            <Link href="/courses" className={styles.backLink}>← Courses</Link>
            <h1 className={styles.courseTitle}>{course.title}</h1>
          </div>

          <BlueVideoPanel
            className={shared.blueVideo}
            message={`Four weeks on ${course.focus.toLowerCase()}. One small step at a time — pick up where you left off.`}
          />

          <div className={shared.weekNav}>
            <button
              className={shared.weekNavArrow}
              onClick={() => goToWeek('prev')}
              onMouseEnter={() => play('hover')}
              disabled={viewWeek <= 1}
              aria-label="Previous week"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>

            <div className={shared.weekNavDots}>
              {course.weeks.map((w) => (
                <button
                  key={w.weekNumber}
                  className={`${shared.weekDot} ${w.weekNumber === viewWeek ? shared.weekDotActive : ''}`}
                  onClick={() => { play('click'); setViewWeek(w.weekNumber); setReadingOpen(false); }}
                  title={`Week ${w.weekNumber}: ${w.theme}`}
                />
              ))}
            </div>

            <button
              className={shared.weekNavArrow}
              onClick={() => goToWeek('next')}
              onMouseEnter={() => play('hover')}
              disabled={viewWeek >= totalWeeks}
              aria-label="Next week"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <span className={shared.weekNavLabel}>Week {week.weekNumber}</span>
          </div>

          <div
            className={`${shared.weekContent} ${swipeAnim === 'left' ? styles.swipeLeft : swipeAnim === 'right' ? styles.swipeRight : ''}`}
          >
            {readingOpen && week.read ? (
              <div className={shared.inlineReader}>
                <button type="button" className={shared.inlineReaderBack} onClick={() => { play('click'); setReadingOpen(false); }}>
                  ← Back to week
                </button>
                <div className={shared.inlineReaderHeader}>
                  <span className={shared.inlineReaderCategory}>Week {week.weekNumber} — {week.theme}</span>
                  <h2 className={shared.inlineReaderTitle}>{week.read.title}</h2>
                </div>
                <div className={shared.inlineReaderBody}>
                  {paragraphs(week.read.body).map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            ) : (
              <>
                {week.read && (
                  <button
                    type="button"
                    className={shared.readingCard}
                    onClick={() => { play('click'); setReadingOpen(true); }}
                    onMouseEnter={() => play('hover')}
                  >
                    <span className={shared.readingAccent} aria-hidden="true" />
                    <span className={`${shared.readingThumb} ${styles.readThumb}`} aria-hidden="true" />
                    <div className={shared.readingInfo}>
                      <span className={shared.readingCategory}>Week {week.weekNumber} — {week.theme}</span>
                      <span className={shared.readingTitle}>{week.read.title}</span>
                    </div>
                    <svg className={shared.readingArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                )}

                <div className={shared.missionsHeadingRow} aria-hidden="true">
                  <span className={shared.missionsDivider} />
                  <h2 className={shared.missionsHeading}>Tasks</h2>
                  <span className={shared.missionsDivider} />
                </div>

                <div className={styles.taskList}>
                  {week.tasks.map((task, i) => {
                    const done = (progress[`week${week.weekNumber}`] ?? []).includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        className={`${styles.taskItem} ${done ? styles.taskItemDone : ''}`}
                        onClick={() => toggleTask(i)}
                        onMouseEnter={() => play('hover')}
                      >
                        <span className={`${styles.taskCheck} ${done ? styles.taskCheckDone : ''}`} aria-hidden="true">
                          {done && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                          )}
                        </span>
                        <span className={styles.taskLabel}>{task}</span>
                      </button>
                    );
                  })}
                </div>

                <p className={styles.taskProgress}>
                  {completedThisWeek} of {week.tasks.length} done this week
                </p>
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
