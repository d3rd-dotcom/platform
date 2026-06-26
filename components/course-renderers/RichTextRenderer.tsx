'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './RichTextRenderer.module.css';

interface RichTextConfig {
  content?: string;
  format?: 'markdown' | 'html';
}

export default function RichTextRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as RichTextConfig;
  const content = config.content ?? '';

  if (!content) {
    return <div className={styles.empty_state}>No content</div>;
  }

  if (config.format === 'html') {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <div className={styles.prose_container}>
      {content.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith('- ')) return <li key={i} className={styles.list_item}>{line.slice(2)}</li>;
        if (line.trim() === '') return <br key={i} />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}
