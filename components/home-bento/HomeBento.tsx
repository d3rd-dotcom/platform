'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import CourseIntake from '@/components/course-intake/CourseIntake';
import Dashboard from '@/components/dashboard/Dashboard';
import AgentRosterCard from '@/components/room-log/AgentRosterCard';
import BlueChatBubble from '@/components/blue-chat-bubble/BlueChatBubble';
import { DotmSquare3 } from '@/components/dot-matrix/DotmSquare3';
import HomeLoader from './HomeLoader';
import type { CourseData, IntakeAnswers } from '@/lib/personal-course';
import styles from './HomeBento.module.css';

type Phase = 'loading' | 'intake' | 'generating' | 'ready';

interface CourseRecord {
  status: string;
  intakeData: IntakeAnswers;
  courseData: CourseData | null;
  progressData: Record<string, unknown>;
}

// Module-level cache so navigating away and back doesn't re-show the loader.
// Persists for the SPA session (cleared on a full page reload), giving us a
// stale-while-revalidate flow: render the last result instantly, refresh quietly.
let courseCache: { record: CourseRecord | null } | null = null;

function phaseFromRecord(record: CourseRecord | null): Phase {
  return record?.status === 'ready' && record.courseData ? 'ready' : 'intake';
}

const GEN_STEPS = [
  'Reading everything you told me…',
  'Lining up your weekly focus…',
  'Picking tasks tuned to your pace…',
  'Putting the finishing touches on it…',
];

const HOME_BLUE_MESSAGE =
  'I keep your plan, gems, agents, and daily work in one place. Pick the next task that can leave evidence today.';

export default function HomeBento() {
  const { ready, getAccessToken } = usePrivy();

  // Every authenticated endpoint reads the Privy JWT from the Authorization
  // header first (cookie is only a fallback). Without this, a refresh often
  // fails server-side auth and the API returns a guest/null course — which
  // wrongly dropped finished users back into the intake flow.
  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [getAccessToken]);
  // Seed from the session cache so a revisit renders instantly instead of flashing the loader.
  const [phase, setPhase] = useState<Phase>(() => (courseCache ? phaseFromRecord(courseCache.record) : 'loading'));
  const [course, setCourse] = useState<CourseRecord | null>(() => courseCache?.record ?? null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [genStep, setGenStep] = useState(0);

  const fetchCourse = useCallback(async () => {
    // A load failure never blocks the page — the intake flow works standalone,
    // so any problem just drops the visitor into intake (guest mode).
    try {
      const res = await fetch('/api/course/personal', {
        cache: 'no-store',
        headers: await authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      const record: CourseRecord | null = data.course ?? null;
      courseCache = { record };
      setCourse(record);
      setPhase(phaseFromRecord(record));
    } catch {
      // Keep any cached data on a transient failure; only fall to intake on a cold load.
      if (!courseCache) {
        courseCache = { record: null };
        setCourse(null);
        setPhase('intake');
      }
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready) return;
    // Always revalidate on mount, but the loader only shows on a cold load
    // (no cache) — a warm revisit refreshes quietly behind the rendered page.
    fetchCourse();
  }, [ready, fetchCourse]);

  // Cycle status copy while generating.
  useEffect(() => {
    if (phase !== 'generating') return;
    const id = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, GEN_STEPS.length - 1));
    }, 4500);
    return () => clearInterval(id);
  }, [phase]);

  const handleIntakeComplete = useCallback(async (answers: IntakeAnswers) => {
    setErrorMsg(null);
    setGenStep(0);
    setPhase('generating');
    try {
      const res = await fetch('/api/course/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.course?.courseData) {
        setCourse((prev) => (prev ? { ...prev, intakeData: answers } : { status: 'intake', intakeData: answers, courseData: null, progressData: {} }));
        setErrorMsg(data?.message || 'Blue could not finish your plan. Give it another try.');
        setPhase('intake');
        return;
      }
      courseCache = { record: data.course };
      setCourse(data.course);
      setPhase('ready');
    } catch {
      setCourse((prev) => (prev ? { ...prev, intakeData: answers } : { status: 'intake', intakeData: answers, courseData: null, progressData: {} }));
      setErrorMsg('Something interrupted the build. Your answers are saved — try again.');
      setPhase('intake');
    }
  }, [authHeaders]);

  // ── Render ──
  if (phase === 'loading') {
    return <HomeLoader />;
  }

  if (phase === 'generating') {
    return (
      <div className={styles.genOverlay} aria-live="polite">
        <div className={styles.genCenter}>
          <DotmSquare3 speed={0.75} dotSize={8} gap={5} />
          <p className={styles.loaderKicker}>Blue is building</p>
          <h1 className={styles.genHeading}>Your plan is coming together</h1>
          <p className={styles.genStatus}>{GEN_STEPS[genStep]}</p>
        </div>
      </div>
    );
  }

  if (phase === 'ready' && course?.courseData) {
    return (
      <div className={styles.bentoScroll}>
        <BlueChatBubble
          className={styles.homeBlueBubble}
          message={HOME_BLUE_MESSAGE}
          variant="featured"
        />
        <Dashboard
          course={course.courseData}
          initialIntake={course.intakeData}
        />
        <AgentRosterCard />
      </div>
    );
  }

  // intake
  return (
    <div className={styles.bentoScroll}>
      <BlueChatBubble
        className={styles.homeBlueBubble}
        message={HOME_BLUE_MESSAGE}
        variant="featured"
      />
      {errorMsg && (
        <div className={styles.intakeNotice} role="alert">
          {errorMsg}
        </div>
      )}
      <CourseIntake
        initialAnswers={course?.intakeData ?? {}}
        onComplete={handleIntakeComplete}
      />
    </div>
  );
}
