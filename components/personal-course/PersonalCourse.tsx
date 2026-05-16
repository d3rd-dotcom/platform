'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import type { CourseData, GeneratedMission } from '@/lib/personal-course';
import styles from './PersonalCourse.module.css';

interface WeekProgress {
  missions?: Record<string, unknown>;
}

type ProgressMap = { weeks?: Record<string, WeekProgress> };

interface PersonalCourseProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  imageGenerationEnabled?: boolean;
}

const WEEK_COLORS = ['#5168FF', '#7C3AED', '#0891B2', '#16A34A'];
const STORY_IMAGE = '/stories/egg.png';

export default function PersonalCourse({
  course,
  initialProgress,
}: PersonalCourseProps) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [progress, setProgress] = useState<ProgressMap>((initialProgress as ProgressMap) ?? {});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const week = useMemo(
    () => course.weeks.find((w) => w.weekNumber === selectedWeek) ?? course.weeks[0],
    [course.weeks, selectedWeek]
  );

  const accent = WEEK_COLORS[(week.weekNumber - 1) % WEEK_COLORS.length];
  const weekProgress: WeekProgress = progress.weeks?.[String(week.weekNumber)] ?? {};

  const persistProgress = useCallback((next: ProgressMap) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/course/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progress: next }),
      }).catch(() => {/* best-effort */});
    }, 800);
  }, []);

  const mutateWeek = useCallback((weekNumber: number, mutate: (w: WeekProgress) => WeekProgress) => {
    setProgress((prev) => {
      const key = String(weekNumber);
      const weeks = { ...(prev.weeks ?? {}) };
      weeks[key] = mutate(weeks[key] ?? {});
      const next = { ...prev, weeks };
      persistProgress(next);
      return next;
    });
  }, [persistProgress]);

  const setMissionValue = useCallback((missionId: string, value: unknown) => {
    mutateWeek(week.weekNumber, (w) => ({
      ...w,
      missions: { ...(w.missions ?? {}), [missionId]: value },
    }));
  }, [mutateWeek, week.weekNumber]);

  return (
    <div className={styles.courseShell} style={{ '--accent': accent } as React.CSSProperties}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarCard}>
          <span className={styles.kicker}>Your personal course</span>
          <h1 className={styles.courseTitle}>{course.title}</h1>
          {course.summary && <p className={styles.courseSummary}>{course.summary}</p>}
        </div>

        <nav className={styles.weekRail} aria-label="Course weeks">
          {course.weeks.map((w) => {
            const active = w.weekNumber === selectedWeek;
            return (
              <button
                key={w.weekNumber}
                type="button"
                className={`${styles.weekTab} ${active ? styles.weekTabActive : ''}`}
                onClick={() => setSelectedWeek(w.weekNumber)}
                style={{ '--tab-accent': WEEK_COLORS[(w.weekNumber - 1) % WEEK_COLORS.length] } as React.CSSProperties}
              >
                <span className={styles.weekTabNum}>Week {w.weekNumber}</span>
                <span className={styles.weekTabTheme}>{w.theme}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className={styles.mainColumn}>
        <section className={styles.storyCard}>
          <div className={styles.storyMedia}>
            <Image src={STORY_IMAGE} alt={week.story.title} fill className={styles.storyImg} />
          </div>
          <div className={styles.storyBody}>
            <span className={styles.cardLabel}>Weekly Story</span>
            <h2 className={styles.storyTitle}>{week.story.title}</h2>
            <p className={styles.storyText}>{week.story.body}</p>
          </div>
        </section>

        <section className={styles.practiceCard}>
          <div className={styles.missionsHeadingRow} aria-hidden="true">
            <span className={styles.missionsDivider} />
            <h2 className={styles.missionsHeading}>Weekly Practice</h2>
            <span className={styles.missionsDivider} />
          </div>
          {week.focus && <p className={styles.focus}>{week.focus}</p>}
          <div className={styles.missionList}>
            {week.missions.map((mission) => (
              <MissionField
                key={mission.id}
                mission={mission}
                value={weekProgress.missions?.[mission.id]}
                onChange={(value) => setMissionValue(mission.id, value)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

interface MissionFieldProps {
  mission: GeneratedMission;
  value: unknown;
  onChange: (value: unknown) => void;
}

function MissionField({ mission, value, onChange }: MissionFieldProps) {
  const [open, setOpen] = useState(false);

  const isDone = (() => {
    if (mission.type === 'text') return typeof value === 'string' && value.trim().length > 0;
    if (mission.type === 'checklist') {
      return Array.isArray(value) && value.some(Boolean);
    }
    return Array.isArray(value) && value.some((v) => typeof v === 'string' && v.trim());
  })();

  return (
    <div className={`${styles.mission} ${open ? styles.missionOpen : ''}`}>
      <button type="button" className={styles.missionHead} onClick={() => setOpen((o) => !o)}>
        <span className={`${styles.missionDot} ${isDone ? styles.missionDotDone : ''}`} />
        <span className={styles.missionTitle}>{mission.title}</span>
        <svg
          className={styles.missionChevron}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className={styles.missionBody}>
          <p className={styles.missionInstructions}>{mission.instructions}</p>

          {mission.type === 'text' && (
            <textarea
              className={styles.missionTextInput}
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={mission.placeholder ?? 'Write your response…'}
              rows={4}
            />
          )}

          {(mission.type === 'list' || mission.type === 'numbered-list') && mission.listLabels && (
            <div className={styles.missionList2}>
              {mission.listLabels.map((label, i) => {
                const arr = Array.isArray(value) ? (value as string[]) : [];
                return (
                  <label key={i} className={styles.listRow}>
                    <span className={styles.listLabel}>{label}</span>
                    <input
                      type="text"
                      className={styles.listInput}
                      value={arr[i] ?? ''}
                      onChange={(e) => {
                        const next = [...arr];
                        next[i] = e.target.value;
                        onChange(next);
                      }}
                    />
                  </label>
                );
              })}
            </div>
          )}

          {mission.type === 'checklist' && mission.checkItems && (
            <div className={styles.checkList}>
              {mission.checkItems.map((item, i) => {
                const arr = Array.isArray(value) ? (value as boolean[]) : [];
                return (
                  <label key={i} className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={Boolean(arr[i])}
                      onChange={(e) => {
                        const next = [...arr];
                        next[i] = e.target.checked;
                        onChange(next);
                      }}
                    />
                    <span>{item}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
