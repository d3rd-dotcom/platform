'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import CourseIntake from '@/components/course-intake/CourseIntake';
import PersonalCourse from '@/components/personal-course/PersonalCourse';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
import type { CourseData, IntakeAnswers } from '@/lib/personal-course';
import styles from './HomeBento.module.css';

type Phase = 'loading' | 'intake' | 'generating' | 'ready';

interface CourseRecord {
  status: string;
  intakeData: IntakeAnswers;
  courseData: CourseData | null;
  progressData: Record<string, unknown>;
}

const GEN_STEPS = [
  'Reading everything you told me…',
  'Shaping four weeks that build on each other…',
  'Writing a story where you are the protagonist…',
  'Designing missions tuned to your pace…',
  'Putting the finishing touches on it…',
];

export default function HomeBento() {
  const { ready } = usePrivy();
  const [phase, setPhase] = useState<Phase>('loading');
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [imageGenEnabled, setImageGenEnabled] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [genStep, setGenStep] = useState(0);
  const fetchedRef = useRef(false);

  const fetchCourse = useCallback(async () => {
    // A load failure never blocks the page — the intake flow works standalone,
    // so any problem just drops the visitor into intake (guest mode).
    try {
      const res = await fetch('/api/course/personal', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setImageGenEnabled(Boolean(data.imageGenerationEnabled));
      const record: CourseRecord | null = data.course ?? null;
      setCourse(record);

      if (record?.status === 'ready' && record.courseData) {
        setPhase('ready');
      } else {
        setPhase('intake');
      }
    } catch {
      setCourse(null);
      setPhase('intake');
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.course?.courseData) {
        setCourse((prev) => (prev ? { ...prev, intakeData: answers } : { status: 'intake', intakeData: answers, courseData: null, progressData: {} }));
        setErrorMsg(data?.message || 'Blue could not finish your course. Give it another try.');
        setPhase('intake');
        return;
      }
      setCourse(data.course);
      setPhase('ready');
    } catch {
      setCourse((prev) => (prev ? { ...prev, intakeData: answers } : { status: 'intake', intakeData: answers, courseData: null, progressData: {} }));
      setErrorMsg('Something interrupted the build. Your answers are saved — try again.');
      setPhase('intake');
    }
  }, []);

  // ── Render ──
  if (phase === 'loading') {
    return (
      <div className={styles.centerWrap}>
        <div className={styles.loaderTerminal} aria-live="polite">
          <DotmSquare15 speed={0.8} dotSize={7} gap={4} />
          <p className={styles.loaderKicker}>Personal course builder</p>
          <h1 className={styles.loaderTitle}>Opening your home space</h1>
          <p className={styles.loaderText}>Blue is checking for your saved course and intake answers.</p>
        </div>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className={styles.bentoScroll}>
        <div className={styles.genGrid}>
          <section className={styles.genHero}>
            <div className={styles.genHeader}>
              <div className={styles.genAvatar}>
                <Image
                  src="/images/a.png"
                  alt="Blue"
                  width={160}
                  height={160}
                  className={styles.genPortrait}
                />
              </div>
              <div className={styles.genCopy}>
                <p className={styles.loaderKicker}>Blue is building</p>
                <h1 className={styles.genTitle}>Your 4-week course is taking shape</h1>
                <p className={styles.genStatus}>{GEN_STEPS[genStep]}</p>
              </div>
            </div>
            <DotmSquare15 speed={0.75} dotSize={6} gap={4} />
            <div className={styles.genBar}>
              <span className={styles.genBarFill} />
            </div>
          </section>
          {[1, 2, 3, 4].map((w) => (
            <section key={w} className={styles.genWeek}>
              <span className={styles.genWeekNum}>Week {w}</span>
              <span className={styles.genSkeleton} style={{ width: '70%' }} />
              <span className={styles.genSkeleton} style={{ width: '90%' }} />
              <span className={styles.genSkeleton} style={{ width: '50%' }} />
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (phase === 'ready' && course?.courseData) {
    return (
      <div className={styles.bentoScroll}>
        <PersonalCourse
          course={course.courseData}
          initialProgress={course.progressData}
          imageGenerationEnabled={imageGenEnabled}
        />
      </div>
    );
  }

  // intake
  return (
    <div className={styles.bentoScroll}>
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
