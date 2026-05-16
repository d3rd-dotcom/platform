'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { CourseData, GeneratedMission } from '@/lib/personal-course';
import styles from './PersonalCourse.module.css';

interface WeekProgress {
  notes?: string;
  missions?: Record<string, unknown>;
}

type ProgressMap = { weeks?: Record<string, WeekProgress> };

interface PersonalCourseProps {
  course: CourseData;
  initialProgress?: Record<string, unknown>;
  imageGenerationEnabled?: boolean;
}

const WEEK_COLORS = ['#5168FF', '#7C3AED', '#0891B2', '#16A34A'];

export default function PersonalCourse({
  course,
  initialProgress,
  imageGenerationEnabled = false,
}: PersonalCourseProps) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [progress, setProgress] = useState<ProgressMap>(
    (initialProgress as ProgressMap) ?? {}
  );
  const [weekImages, setWeekImages] = useState<Record<number, string>>({});
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const requestedImages = useRef<Set<number>>(new Set());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const week = useMemo(
    () => course.weeks.find((w) => w.weekNumber === selectedWeek) ?? course.weeks[0],
    [course.weeks, selectedWeek]
  );
  const accent = WEEK_COLORS[(week.weekNumber - 1) % WEEK_COLORS.length];
  const storyImage = weekImages[week.weekNumber] ?? week.story.imageUrl;

  // Lazily generate the story illustration for the active week.
  useEffect(() => {
    const n = week.weekNumber;
    if (storyImage || requestedImages.current.has(n)) return;
    requestedImages.current.add(n);
    setImageLoading((prev) => ({ ...prev, [n]: true }));

    fetch('/api/course/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekNumber: n, imagePrompt: week.story.imagePrompt }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.imageUrl) {
          setWeekImages((prev) => ({ ...prev, [n]: data.imageUrl }));
        }
      })
      .catch(() => {/* fallback art handled server-side */})
      .finally(() => setImageLoading((prev) => ({ ...prev, [n]: false })));
  }, [week.weekNumber, storyImage]);

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

  const weekProgress: WeekProgress = progress.weeks?.[String(week.weekNumber)] ?? {};

  const setNotes = useCallback((value: string) => {
    mutateWeek(week.weekNumber, (w) => ({ ...w, notes: value }));
  }, [mutateWeek, week.weekNumber]);

  const setMissionValue = useCallback((missionId: string, value: unknown) => {
    mutateWeek(week.weekNumber, (w) => ({
      ...w,
      missions: { ...(w.missions ?? {}), [missionId]: value },
    }));
  }, [mutateWeek, week.weekNumber]);

  return (
    <div className={styles.courseGrid} style={{ '--accent': accent } as React.CSSProperties}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <span className={styles.kicker}>Your personal course</span>
        <h1 className={styles.courseTitle}>{course.title}</h1>
        {course.summary && <p className={styles.courseSummary}>{course.summary}</p>}
      </header>

      {/* ── Week tabs ── */}
      <nav className={styles.weekTabs} aria-label="Course weeks">
        {course.weeks.map((w) => (
          <button
            key={w.weekNumber}
            type="button"
            className={`${styles.weekTab} ${w.weekNumber === selectedWeek ? styles.weekTabActive : ''}`}
            onClick={() => setSelectedWeek(w.weekNumber)}
            style={{ '--tab-accent': WEEK_COLORS[(w.weekNumber - 1) % WEEK_COLORS.length] } as React.CSSProperties}
          >
            <span className={styles.weekTabNum}>Week {w.weekNumber}</span>
            <span className={styles.weekTabTheme}>{w.theme}</span>
          </button>
        ))}
      </nav>

      {/* ── Weekly Story ── */}
      <section className={`${styles.card} ${styles.storyCard}`}>
        <div className={styles.storyMedia}>
          {storyImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={storyImage} alt={week.story.title} className={styles.storyImg} />
          ) : (
            <div className={styles.storyImgLoading}>
              <span className={styles.storySpinner} />
              <span>{imageGenerationEnabled ? 'Painting your scene…' : 'Loading scene…'}</span>
            </div>
          )}
          {imageLoading[week.weekNumber] && storyImage && (
            <span className={styles.storyRefresh} />
          )}
        </div>
        <div className={styles.storyBody}>
          <span className={styles.cardLabel}>Weekly Story</span>
          <h2 className={styles.storyTitle}>{week.story.title}</h2>
          <p className={styles.storyText}>{week.story.body}</p>
        </div>
      </section>

      {/* ── Morning Notes ── */}
      <section className={`${styles.card} ${styles.morningCard}`}>
        <span className={styles.cardLabel}>Morning Notes</span>
        <h2 className={styles.sectionTitle}>{week.theme}</h2>
        {week.morningNotes.intention && (
          <p className={styles.intention}>“{week.morningNotes.intention}”</p>
        )}
        <p className={styles.prompt}>{week.morningNotes.prompt}</p>
        <textarea
          className={styles.notesInput}
          value={weekProgress.notes ?? ''}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Start writing your morning notes for this week…"
          rows={5}
        />
      </section>

      {/* ── Missions ── */}
      <section className={`${styles.card} ${styles.missionsCard}`}>
        <span className={styles.cardLabel}>Missions</span>
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
    </div>
  );
}

// ── Mission field ───────────────────────────────────────────
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
