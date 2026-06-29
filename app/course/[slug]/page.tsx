'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import type { CourseRecord } from '@/lib/course-content-db';
import type { ChapterRecord, LessonRecord } from '@/lib/course-content-db';
import styles from './page.module.css';

const ANGEL_IMAGE = 'https://i.imgur.com/KkpN9as.png';

type PageProps = {
  params: { slug: string };
};

export default function CourseSlugPage({ params }: PageProps) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [chapters, setChapters] = useState<Array<ChapterRecord & { lessons: LessonRecord[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [accessGranted, setAccessGranted] = useState(false);
  const [gate, setGate] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    loadCourse();
  }, [ready, params.slug]);

  const loadCourse = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/course-content/${params.slug}`);
      if (!res.ok) {
        if (res.status === 404) setNotFound(true);
        return;
      }
      const data = await res.json();
      setCourse(data.course);
      setChapters(data.chapters ?? []);
      if (data.chapters?.length > 0) {
        setActiveChapter(data.chapters[0].id);
      }
      checkAccess();
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  const checkAccess = async () => {
    setCheckingAccess(true);
    try {
      const res = await fetch(`/api/course-content/${params.slug}/access`);
      if (res.ok) {
        const data = await res.json();
        setAccessGranted(data.granted);
        setGate(data.gate || null);
      } else {
        setAccessGranted(false);
      }
    } catch {
      setAccessGranted(false);
    } finally {
      setCheckingAccess(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <p className={styles.stateText}>Loading course…</p>
          </div>
        </main>
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.stateWrap}>
            <h1 className={styles.stateHeading}>Course not found</h1>
            <p className={styles.stateText}>This course doesn&apos;t exist or hasn&apos;t been published yet.</p>
            <Link href="/courses" className={styles.backBtn}>Back to courses</Link>
          </div>
        </main>
      </div>
    );
  }

  if (checkingAccess) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <p className={styles.stateText}>Checking access…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!accessGranted && gate) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.gateCard}>
            <img src={ANGEL_IMAGE} alt="" className={styles.gateImage} />
            <h1 className={styles.gateTitle}>Academic Angels only</h1>
            <p className={styles.gateDesc}>
              This course requires an <strong>Academic Angel NFT</strong>. Hold one to unlock access.
            </p>
            <Link href="/courses" className={styles.backBtn}>Back to courses</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>
        <Link href="/courses" className={styles.backLink}>← Courses</Link>

        <div className={styles.courseHeader}>
          <h1 className={styles.courseTitle}>{course.title}</h1>
          {course.summary && <p className={styles.courseSummary}>{course.summary}</p>}
          {course.tokenGate && (
            <span className={styles.memberBadge}>Academic Angels</span>
          )}
        </div>

        {chapters.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.stateText}>This course has no content yet.</p>
          </div>
        ) : (
          <div className={styles.chapterList}>
            {chapters.map((chapter) => (
              <div key={chapter.id} className={styles.chapterCard}>
                <button
                  type="button"
                  className={styles.chapterHeader}
                  onClick={() => setActiveChapter(activeChapter === chapter.id ? null : chapter.id)}
                >
                  <span className={styles.chapterTitle}>{chapter.title}</span>
                  <span className={styles.chapterToggle}>
                    {activeChapter === chapter.id ? '−' : '+'}
                  </span>
                </button>
                {activeChapter === chapter.id && chapter.lessons.length > 0 && (
                  <div className={styles.lessonList}>
                    {chapter.lessons.map((lesson) => (
                      <div key={lesson.id} className={styles.lessonItem}>
                        <span className={styles.lessonType}>{lesson.lessonType}</span>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
