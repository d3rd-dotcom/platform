'use client';

import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import type { GuideBodyComponent } from '@/lib/guides-db';
import styles from './GuideBody.module.css';

/**
 * Adapts a guide body component (stored as { id, componentType, title, config })
 * into the CourseComponentRecord the existing course renderers expect, then
 * hands it to ComponentRenderer. Guides are read-only content, so no
 * onComponentUpdate / grading is wired in.
 */
function toComponentRecord(c: GuideBodyComponent): CourseComponentRecord {
  return {
    id: c.id,
    weekId: '',
    sortOrder: 0,
    componentType: (c.componentType as CourseComponentRecord['componentType']) || 'rich_text',
    title: c.title ?? '',
    config: c.config ?? {},
    required: false,
    blocks: (c.blocks as unknown as CourseComponentRecord['blocks']) ?? [],
    createdAt: '',
    updatedAt: '',
  };
}

export default function GuideBody({ body }: { body: GuideBodyComponent[] }) {
  if (!body || body.length === 0) {
    return <div className={styles.empty}>This guide has no content yet.</div>;
  }
  return (
    <div className={styles.body}>
      {body.map((c) => (
        <div key={c.id} className={styles.block}>
          {c.title ? <h3 className={styles.blockTitle}>{c.title}</h3> : null}
          <ComponentRenderer component={toComponentRecord(c)} />
        </div>
      ))}
    </div>
  );
}
