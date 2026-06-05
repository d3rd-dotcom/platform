'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { BookOpen, Sparkle } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import type { CourseData } from '@/lib/personal-course';
import styles from './page.module.css';

function getCourseEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 84); // 12 weeks
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPersonalEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 28); // 4 weeks
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function openCourseBuilder() {
  (window as Window & { __blueCourseBuilderOnOpen?: boolean }).__blueCourseBuilderOnOpen = true;
  window.dispatchEvent(new Event('toggleBlueChat'));
}

export default function CoursesPage() {
  const { ready, getAccessToken } = usePrivy();
  const [personalCourse, setPersonalCourse] = useState<CourseData | null>(null);

  const loadPersonalCourse = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/course/personal', { cache: 'no-store', headers });
      const data = await res.json().catch(() => ({}));
      const record = data?.course;
      if (record?.status === 'ready' && record?.courseData?.weeks?.length) {
        setPersonalCourse(record.courseData as CourseData);
      } else {
        setPersonalCourse(null);
      }
    } catch {
      setPersonalCourse(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    loadPersonalCourse();
  }, [ready, loadPersonalCourse]);

  // A course built in Blue's chat should appear here without a manual refresh.
  useEffect(() => {
    const handler = () => loadPersonalCourse();
    window.addEventListener('personalCourseUpdated', handler);
    return () => window.removeEventListener('personalCourseUpdated', handler);
  }, [loadPersonalCourse]);

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Popular Courses</h1>
        </div>
        <div className={styles.grid}>

          <Link href="/course" className={styles.courseCard}>
            <div className={styles.courseImageWrap}>
              <div className={styles.courseNoise} aria-hidden="true" />
              <div className={styles.courseIconBadge}>
                <BookOpen size={16} weight="duotone" />
              </div>
            </div>
            <div className={styles.courseBody}>
              <h2 className={styles.courseTitle}>Artist&apos;s Awakening</h2>
              <p className={styles.courseDesc}>
                A journey through rediscovering your creative energy and excavating it to reach your highest horizon.
              </p>
              <span className={styles.courseEndBadge}>End date: {getCourseEndDate()}</span>
            </div>
          </Link>

          {personalCourse && (
            <Link href="/course/personal" className={styles.courseCard}>
              <div className={`${styles.courseImageWrap} ${styles.personalImageWrap}`}>
                <div className={styles.courseNoise} aria-hidden="true" />
                <div className={styles.courseIconBadge}>
                  <Sparkle size={16} weight="duotone" />
                </div>
              </div>
              <div className={styles.courseBody}>
                <span className={styles.coursePersonalTag}>Your course</span>
                <h2 className={styles.courseTitle}>{personalCourse.title}</h2>
                <p className={styles.courseDesc}>
                  A personal 4-week track built around {personalCourse.focus.toLowerCase()} — a weekly read and tasks tuned to your goal.
                </p>
                <span className={styles.courseEndBadge}>End date: {getPersonalEndDate()}</span>
              </div>
            </Link>
          )}

          <button type="button" onClick={openCourseBuilder} className={styles.buildCard}>
            <div className={styles.buildIcon}>
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                <rect x="1" y="1" width="46" height="46" rx="11" stroke="currentColor" strokeWidth="2" />
                <line x1="24" y1="14" x2="24" y2="34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </button>

        </div>
      </main>
    </div>
  );
}
