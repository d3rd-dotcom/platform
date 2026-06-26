'use client';

import { useEffect, useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './MarkdownFileRenderer.module.css';

interface MarkdownFileConfig {
  url?: string;
  originalName?: string;
  content?: string;
}

export default function MarkdownFileRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as MarkdownFileConfig;
  const [content, setContent] = useState<string | null>(config.content ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (content || !config.url) return;
    setLoading(true);
    fetch(config.url)
      .then((res) => res.text())
      .then(setContent)
      .catch(() => setContent('*Failed to load content*'))
      .finally(() => setLoading(false));
  }, [config.url, content]);

  if (loading) return <div className={styles.empty_state}>Loading...</div>;
  if (!content) return <div className={styles.empty_state}>No content</div>;

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
