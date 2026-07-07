'use client';

import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import type { GuideBodyComponent } from '@/lib/guides-db';
import styles from './GuideBody.module.css';

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

export default function GuideBody({ body, topicTitle }: { body: GuideBodyComponent[]; topicTitle?: string }) {
  if (!body || body.length === 0) {
    return <div className={styles.empty}>This guide has no content yet.</div>;
  }
  return (
    <div className={styles.body}>
      {body.map((c, i) => {
        const isFirst = i === 0;
        const titleMatch = c.title && topicTitle &&
          c.title.trim().toLowerCase() === topicTitle.trim().toLowerCase();
        const showTitle = !isFirst && c.title && !titleMatch;

        if (isFirst) {
          return (
            <div key={c.id} className={styles.lede}>
              <ComponentRenderer component={toComponentRecord(c)} />
            </div>
          );
        }

        return (
          <section key={c.id} className={styles.section}>
            {showTitle && <h2 className={styles.sectionTitle}>{c.title}</h2>}
            <ComponentRenderer component={toComponentRecord(c)} />
          </section>
        );
      })}
    </div>
  );
}
