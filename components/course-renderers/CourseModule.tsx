'use client';

import { useEffect, useState } from 'react';
import ComponentRenderer from './ComponentRenderer';
import type { VipCourseFull } from '@/lib/vip-course-db';
import styles from './CourseModule.module.css';

interface CourseModuleProps {
  courseSlug?: string;
  courseId?: string;
  weekNumber?: number;
  authHeaders?: () => Promise<HeadersInit>;
}

export default function CourseModule({
  courseSlug,
  courseId,
  weekNumber = 1,
  authHeaders,
}: CourseModuleProps) {
  const [course, setCourse] = useState<VipCourseFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!courseId && !courseSlug) { setLoading(false); return; }

    const url = courseId
      ? `/api/vip/courses/${courseId}`
      : `/api/vip/courses/slug/${courseSlug}`;

    setLoading(true);
    (async () => {
      const headers = authHeaders ? await authHeaders() : undefined;
      fetch(url, { headers })
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load course');
          return res.json();
        })
        .then((data) => setCourse(data.course))
        .catch((err) => setError(err.message))
        .finally(() => setLoading(false));
    })();
  }, [courseId, courseSlug, authHeaders]);

  if (loading) return <div className={styles.loading}>Loading course...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!course) return <div className={styles.no_course}>No course found</div>;

  const week = course.weeks.find((w) => w.weekNumber === weekNumber) ?? course.weeks[0];
  if (!week) return <div className={styles.no_weeks}>No weeks in this course</div>;

  return (
    <div>
      <div className={styles.header}>
        <h2 className={styles.week_title}>{week.title || `Week ${week.weekNumber}`}</h2>
        {week.theme && <p className={styles.week_theme}>{week.theme}</p>}
      </div>
      <div className={styles.components_list}>
        {week.components.map((component) => (
          <div key={component.id} className={styles.component_card}>
            {component.title && (
              <h3 className={styles.component_title}>{component.title}</h3>
            )}
            <ComponentRenderer component={component} />
          </div>
        ))}
      </div>
    </div>
  );
}
