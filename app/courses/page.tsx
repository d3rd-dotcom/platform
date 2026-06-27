'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Plus } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CourseStudioModal from '@/components/course-studio/CourseStudioModal';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import type { CourseData } from '@/lib/personal-course';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
import styles from './page.module.css';

function getCourseEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 84);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPersonalEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 28);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const COURSE_THUMB = 'https://i.imgur.com/KkpN9as.png';

export default function CoursesPage() {
  const { ready, getAccessToken } = usePrivy();
  const [personalCourse, setPersonalCourse] = useState<CourseData | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const loadPersonalCourse = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(personalCourseUrl(), { cache: 'no-store', headers });
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

  useEffect(() => onPersonalCourseUpdated(loadPersonalCourse), [loadPersonalCourse]);

  if (studioOpen) {
    return (
      <CourseStudioModal
        authHeaders={authHeaders}
        onClose={() => setStudioOpen(false)}
        onCourseCreated={() => {
          setStudioOpen(false);
          loadPersonalCourse();
        }}
      />
    );
  }

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>

        <BlueVideoPanel
          className={styles.blueVideo}
          message="Your courses — pick up where you left off."
        />

        <div className={styles.divider} aria-hidden="true" />

        <Link href="/course" className={styles.courseCard}>
          <span className={styles.accent} aria-hidden="true" />
          <span
            className={styles.thumb}
            style={{ backgroundImage: `url(${JSON.stringify(COURSE_THUMB)})` }}
            aria-hidden="true"
          />
          <div className={styles.body}>
            <span className={styles.category}>12-Week Core</span>
            <span className={styles.title}>Creative Healing</span>
            <span className={styles.desc}>
              A journey through rediscovering your creative energy and excavating it to reach your highest horizon.
            </span>
          </div>
          <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        {personalCourse && (
          <Link href="/course/personal" className={styles.courseCard}>
            <span className={styles.accent} aria-hidden="true" />
            <span className={`${styles.thumb} ${styles.personalThumb}`} aria-hidden="true" />
            <div className={styles.body}>
              <span className={styles.category}>Your course</span>
              <span className={styles.title}>{personalCourse.title}</span>
              <span className={styles.desc}>
                A personal 4-week track built around {personalCourse.focus.toLowerCase()} — a weekly read and tasks tuned to your goal.
              </span>
            </div>
            <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        )}

        <button type="button" onClick={() => setStudioOpen(true)} className={styles.buildCard}>
          <Plus size={20} weight="bold" />
          <span>Build your own course</span>
        </button>

      </main>
    </div>
  );
}
