'use client';

import { useRef, useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './MediaEmbedRenderer.module.css';

interface MediaEmbedConfig {
  url?: string;
  alt?: string;
  caption?: string;
  width?: string;
  alignment?: 'left' | 'center' | 'right';
}

function isVideoUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
}

function getEmbedUrl(url: string): string {
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

export default function MediaEmbedRenderer({
  component,
  onComponentUpdate,
}: {
  component: CourseComponentRecord;
  onComponentUpdate?: (updates: Partial<CourseComponentRecord>) => void;
}) {
  const config = component.config as MediaEmbedConfig;
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
              accept="image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm"
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
          'No media selected'
        )}
      </div>
    );
  }

  if (isVideoUrl(config.url)) {
    const embedUrl = getEmbedUrl(config.url);
    return (
      <figure className={styles.figure}>
        <div className={styles.video_wrapper}>
          <iframe
            src={embedUrl}
            className={styles.iframe}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={component.title}
          />
        </div>
        {config.caption && (
          <figcaption className={styles.caption}>{config.caption}</figcaption>
        )}
      </figure>
    );
  }

  const alignClass = config.alignment === 'left' ? styles.align_left : config.alignment === 'right' ? styles.align_right : styles.align_center;

  return (
    <figure className={`${styles.figure} ${alignClass}`} style={{ width: config.width ?? 'auto' }}>
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
