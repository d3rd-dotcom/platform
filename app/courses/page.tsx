'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Plus, PencilSimple, CheckCircle } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CourseStudioModal from '@/components/course-studio/CourseStudioModal';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import type { CourseData } from '@/lib/personal-course';
import type { VipCourseRecord } from '@/lib/vip-course-db';
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
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [authoredCourses, setAuthoredCourses] = useState<VipCourseRecord[]>([]);

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
    loadAuthoredCourses();
  }, [ready, loadPersonalCourse]);

  useEffect(() => onPersonalCourseUpdated(loadPersonalCourse), [loadPersonalCourse]);

  const loadAuthoredCourses = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/vip/courses', { cache: 'no-store', headers });
      if (!res.ok) return;
      const data = await res.json();
      setAuthoredCourses(data.courses ?? []);
    } catch { /* ignore */ }
  }, [authHeaders]);

  const handleCourseCreated = useCallback(() => {
    setStudioOpen(false);
    setEditingCourseId(null);
    loadPersonalCourse();
    loadAuthoredCourses();
  }, [loadPersonalCourse, loadAuthoredCourses]);

  if (studioOpen || editingCourseId) {
    return (
      <CourseStudioModal
        authHeaders={authHeaders}
        onClose={() => { setStudioOpen(false); setEditingCourseId(null); }}
        onCourseCreated={handleCourseCreated}
        existingCourseId={editingCourseId ?? undefined}
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

        {authoredCourses.length > 0 && (
          <section className={styles.authoredSection}>
            <h2 className={styles.authoredHeading}>Your authored courses</h2>
            <div className={styles.authoredList}>
              {authoredCourses.map((c) => (
                <div key={c.id} className={styles.authoredCard}>
                  <div className={styles.authoredBody}>
                    <span className={styles.authoredTitle}>{c.title}</span>
                    <span className={styles.authoredSlug}>/{c.slug}</span>
                    <span className={`${styles.authoredStatus} ${c.status === 'published' ? styles.authoredStatusPublished : ''}`}>
                      {c.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditingCourseId(c.id)}
                    className={styles.authoredEditBtn}
                    title="Edit course"
                  >
                    <PencilSimple size={16} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
