'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';

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
    return <div className="text-neutral-500 italic">No image selected</div>;
  }

  const alignClass = config.alignment === 'left' ? 'mr-auto' : config.alignment === 'right' ? 'ml-auto' : 'mx-auto';

  return (
    <figure className={`max-w-full ${alignClass}`} style={{ width: config.width ?? 'auto' }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={config.url}
        alt={config.alt ?? ''}
        className="rounded-lg w-full h-auto object-cover"
        loading="lazy"
      />
      {config.caption && (
        <figcaption className="text-sm text-neutral-500 mt-1 text-center">{config.caption}</figcaption>
      )}
    </figure>
  );
}
