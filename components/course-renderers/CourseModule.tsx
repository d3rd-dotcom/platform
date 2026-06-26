'use client';

import { useEffect, useState } from 'react';
import ComponentRenderer from './ComponentRenderer';
import type { VipCourseFull } from '@/lib/vip-course-db';

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

  if (loading) return <div className="text-neutral-500 italic p-4">Loading course...</div>;
  if (error) return <div className="text-red-500 p-4">{error}</div>;
  if (!course) return <div className="text-neutral-500 italic p-4">No course found</div>;

  const week = course.weeks.find((w) => w.weekNumber === weekNumber) ?? course.weeks[0];
  if (!week) return <div className="text-neutral-500 italic p-4">No weeks in this course</div>;

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-bold">{week.title || `Week ${week.weekNumber}`}</h2>
        {week.theme && <p className="text-sm text-neutral-500">{week.theme}</p>}
      </div>
      <div className="space-y-6">
        {week.components.map((component) => (
          <div key={component.id} className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
            {component.title && (
              <h3 className="font-medium text-sm text-neutral-500 mb-2 uppercase tracking-wide">{component.title}</h3>
            )}
            <ComponentRenderer component={component} />
          </div>
        ))}
      </div>
    </div>
  );
}
