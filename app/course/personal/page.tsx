'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import { useSound } from '@/hooks/useSound';
import type { CourseData } from '@/lib/personal-course';
import shared from '../page.module.css';
import wt from '@/components/week-tasks/WeekTasksView.module.css';
import styles from './personal.module.css';

type ProgressMap = Record<string, number[]>;

// Same calm-rainbow accents and artwork tiles the 12-week missions use, so a
// custom course week reads exactly like a main course week.
const TASK_ACCENTS = [
  '#5168FF', '#7C8FFF', '#8B5CF6', '#A855F7',
  '#38BDF8', '#22D3EE', '#2DD4BF', '#34D399',
];

const TASK_ART_VARIANTS = ['Aurora', 'Sunrise', 'Orbit', 'Bloom', 'Ribbon', 'Prism'] as const;

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
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Same breakpoint as the 12-week course page: desktop pins the content to a
  // 420px left column and opens the weekly read in the right panel.
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

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

  const deleteCourse = async () => {
    if (deleting) return;
    play('click');
    setDeleting(true);
    setDeleteError(false);
    try {
      const res = await fetch('/api/course/personal', {
        method: 'DELETE',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.deleted) {
        setDeleteError(true);
        return;
      }
      setCourse(null);
      setProgress({});
      setConfirmingDelete(false);
      window.dispatchEvent(new Event('personalCourseUpdated'));
    } catch {
      setDeleteError(true);
    } finally {
      setDeleting(false);
    }
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

  // The weekly read renders inline on mobile and in the right panel on
  // desktop — same reader markup either way.
  const reader = week.read ? (
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
  ) : null;

  return (
    <div className={shared.pageLayout}>
      <SideNavigation />
      <main className={`${shared.content} ${isDesktop ? shared.contentDesktop : ''}`}>
        <div className={isDesktop ? shared.leftCol : undefined}>

          <div className={styles.courseHead}>
            <Link href="/courses" className={styles.backLink}>← Courses</Link>
            <h1 className={styles.courseTitle}>{course.title}</h1>
            <div className={styles.deleteRow}>
              {confirmingDelete ? (
                <>
                  <span className={styles.deleteConfirmText}>
                    {deleteError ? 'Could not delete — try again.' : 'Delete this course and its progress for good?'}
                  </span>
                  <button
                    type="button"
                    className={styles.deleteConfirmBtn}
                    onClick={deleteCourse}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete it'}
                  </button>
                  <button
                    type="button"
                    className={styles.deleteCancelBtn}
                    onClick={() => { play('click'); setConfirmingDelete(false); setDeleteError(false); }}
                    disabled={deleting}
                  >
                    Keep it
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.deleteLink}
                  onClick={() => { play('click'); setConfirmingDelete(true); }}
                >
                  Delete this course
                </button>
              )}
            </div>
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
            {readingOpen && week.read && !isDesktop ? (
              reader
            ) : (
              <>
                {week.read && (
                  <button
                    type="button"
                    className={`${shared.readingCard} ${isDesktop && readingOpen ? shared.readingCardActive : ''}`}
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
                  <h2 className={shared.missionsHeading}>Missions</h2>
                  <span className={shared.missionsDivider} />
                </div>

                <div className={wt.container}>
                  {week.tasks.map((task, i) => {
                    const done = (progress[`week${week.weekNumber}`] ?? []).includes(i);
                    const artVariant = TASK_ART_VARIANTS[i % TASK_ART_VARIANTS.length];
                    return (
                      <div
                        key={i}
                        className={`${wt.taskCard} ${done ? wt.taskCardDone : ''}`}
                        style={{ '--task-accent': TASK_ACCENTS[i % TASK_ACCENTS.length] } as React.CSSProperties}
                      >
                        <button
                          type="button"
                          className={wt.taskCardHeader}
                          onClick={() => toggleTask(i)}
                          onMouseEnter={() => play('hover')}
                        >
                          <span className={wt.taskAccent} aria-hidden="true" />
                          <div className={`${wt.taskArtwork} ${wt[`taskArtwork${artVariant}`]}`} aria-hidden="true">
                            <div className={wt.taskArtworkGlow} />
                            <div className={wt.taskArtworkLine} />
                          </div>
                          <div className={wt.taskInfo}>
                            <span className={wt.taskTitle}>{task}</span>
                          </div>
                          <div className={wt.taskRight}>
                            {done ? (
                              <div className={wt.taskCheckDone}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </div>
                            ) : (
                              <div className={wt.taskCheckEmpty} />
                            )}
                          </div>
                        </button>
                      </div>
                    );
                  })}

                  <div className={wt.sealSection}>
                    <div className={wt.progressInfo}>
                      <span className={wt.progressText}>{completedThisWeek} / {week.tasks.length} tasks completed</span>
                      <div className={wt.progressBar}>
                        <div
                          className={wt.progressBarFill}
                          style={{ width: `${week.tasks.length ? (completedThisWeek / week.tasks.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {isDesktop && readingOpen && week.read && (
          <div className={shared.rightPanel}>
            {reader}
          </div>
        )}
      </main>
    </div>
  );
}
