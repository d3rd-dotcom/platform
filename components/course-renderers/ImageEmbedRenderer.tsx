'use client';

import { useRef, useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ImageEmbedRenderer.module.css';

interface ImageEmbedConfig {
  url?: string;
  alt?: string;
  caption?: string;
  width?: string;
  alignment?: 'left' | 'center' | 'right';
}

export default function ImageEmbedRenderer({
  component,
  onComponentUpdate,
}: {
  component: CourseComponentRecord;
  onComponentUpdate?: (updates: Partial<CourseComponentRecord>) => void;
}) {
  const config = component.config as ImageEmbedConfig;
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      const data = await res.json();
      if (res.ok && data.url) {
        onComponentUpdate?.({ config: { ...config, url: data.url, alt: file.name } });
      }
    } catch { /* silent */ }
    finally { setUploading(false); }
  };

  if (!config.url) {
    return (
      <div className={styles.empty_state}>
        {onComponentUpdate ? (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={handleUpload}
              className={styles.fileInput}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Click to import image'}
            </button>
          </>
        ) : (
          'No image selected'
        )}
      </div>
    );
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
