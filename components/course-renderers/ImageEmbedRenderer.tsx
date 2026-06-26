'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ImageEmbedRenderer.module.css';

interface ImageEmbedConfig {
  url?: string;
  alt?: string;
  caption?: string;
  width?: string;
  alignment?: 'left' | 'center' | 'right';
}

export default function ImageEmbedRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as ImageEmbedConfig;

  if (!config.url) {
    return <div className={styles.empty_state}>No image selected</div>;
  }

  const alignClass = config.alignment === 'left' ? styles.align_left : config.alignment === 'right' ? styles.align_right : styles.align_center;

  return (
    <figure className={`${styles.figure} ${alignClass}`} style={{ width: config.width ?? 'auto' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.url}
        alt={config.alt ?? ''}
        className={styles.img}
        loading="lazy"
      />
      {config.caption && (
        <figcaption className={styles.caption}>{config.caption}</figcaption>
      )}
    </figure>
  );
}
