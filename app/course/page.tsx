'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BookCard from '@/components/book-card/BookCard';
import CtaButton from '@/components/shared/CtaButton';
import type { CourseRecord } from '@/lib/course-content-db';
import styles from './library.module.css';

interface PublicCourseCard {
  id: string;
  slug: string;
  title: string;
  focus: string;
  coverImageUrl: string | null;
  authorName: string;
  weekCount: number;
  totalTasks: number;
}

interface LibraryCourseCard {
  id: string;
  slug: string;
  title: string;
  description: string;
  imageUrl: string;
  metadata: string;
  category: string;
}

export default function CourseLibraryPage() {
  const [courses, setCourses] = useState<LibraryCourseCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadCourses = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const [academyResponse, publicResponse] = await Promise.all([
        fetch('/api/course-content', { cache: 'no-store' }),
        fetch('/api/vip/courses/public', { cache: 'no-store', credentials: 'include' }),
      ]);
      if (!academyResponse.ok || !publicResponse.ok) throw new Error('Course request failed');

      const [academyData, publicData] = await Promise.all([
        academyResponse.json(),
        publicResponse.json(),
      ]);
      const academyCourses: CourseRecord[] = academyData.courses ?? [];
      const publicCourses: PublicCourseCard[] = publicData.courses ?? [];
      const seenSlugs = new Set<string>();
      const libraryCourses: LibraryCourseCard[] = [];

      for (const course of academyCourses) {
        seenSlugs.add(course.slug);
        libraryCourses.push({
          id: `academy-${course.id}`,
          slug: course.slug,
          title: course.title,
          description: course.summary || course.description,
          imageUrl: course.coverImageUrl || '/academy-story.png',
          metadata: course.estimatedWeeks
            ? `${course.estimatedWeeks} week${course.estimatedWeeks === 1 ? '' : 's'}`
            : 'Self-paced',
          category: course.tokenGate ? 'Academic Angels' : 'Academy course',
        });
      }

      for (const course of publicCourses) {
        if (seenSlugs.has(course.slug)) continue;
        libraryCourses.push({
          id: `public-${course.id}`,
          slug: course.slug,
          title: course.title,
          description: `Study ${course.focus.toLowerCase()} through weekly readings and practical tasks.`,
          imageUrl: course.coverImageUrl || '/academy-story.png',
          metadata: `${course.weekCount} week${course.weekCount === 1 ? '' : 's'} · ${course.totalTasks} task${course.totalTasks === 1 ? '' : 's'}`,
          category: course.authorName || 'Academy course',
        });
      }

      setCourses(libraryCourses);
    } catch {
      setCourses([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses();
  }, [loadCourses]);

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/home" className={styles.backLink}>
            <span aria-hidden="true">←</span>
            Academy
          </Link>
          <p className={styles.eyebrow}>Course Library</p>
          <h1 className={styles.title}>Choose your next course.</h1>
          <p className={styles.intro}>
            Study behavioral psychology, technology, and mental wealth through structured lessons and practical tasks.
          </p>
        </header>

        {loading ? (
          <section className={styles.grid} aria-label="Loading courses" aria-busy="true">
            {[0, 1, 2].map((item) => (
              <div key={item} className={styles.skeleton} aria-hidden="true">
                <div className={styles.skeletonImage} />
                <div className={styles.skeletonBody}>
                  <span className={styles.skeletonLineWide} />
                  <span className={styles.skeletonLine} />
                  <span className={styles.skeletonLineShort} />
                </div>
              </div>
            ))}
          </section>
        ) : error ? (
          <section className={styles.stateCard} role="alert">
            <h2>Courses could not load.</h2>
            <p>The library is temporarily unavailable.</p>
            <CtaButton size="sm" className={styles.retryButton} onClick={() => void loadCourses()}>
              Try again
            </CtaButton>
          </section>
        ) : courses.length === 0 ? (
          <section className={styles.previewSection} aria-label="Course card preview">
            <div className={styles.previewNote}>
              <span className={styles.previewLabel}>Preview</span>
              <p>Published courses will use this card format.</p>
            </div>
            <div className={styles.grid}>
              <BookCard
                title="Foundations of Mental Wealth"
                author="Self-paced"
                description="Study behavioral patterns through short readings, reflection prompts, and practical tasks."
                category="Course preview"
                imageUrl="/academy-story.png"
              />
            </div>
          </section>
        ) : (
          <section className={styles.grid} aria-label="Academy courses">
            {courses.map((course) => (
              <BookCard
                key={course.id}
                title={course.title}
                author={course.metadata}
                description={course.description}
                category={course.category}
                imageUrl={course.imageUrl}
                href={`/course/${course.slug}`}
                actionLabel="Open course"
              />
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
