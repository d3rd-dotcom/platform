'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface VideoEmbedConfig {
  url?: string;
  provider?: 'youtube' | 'vimeo' | 'upload';
  transcript?: string;
}

function getEmbedUrl(url: string, provider?: string): string | null {
  if (provider === 'youtube') {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }
  if (provider === 'vimeo') {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  if (provider === 'upload') return url;
  // auto-detect
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : url;
  }
  if (url.includes('vimeo.com')) {
    const match = url.match(/vimeo\.com\/(\d+)/);
    return match ? `https://player.vimeo.com/video/${match[1]}` : url;
  }
  return url;
}

export default function VideoEmbedRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as VideoEmbedConfig;

  if (!config.url) {
    return <div className="text-neutral-500 italic">No video URL</div>;
  }

  const embedUrl = getEmbedUrl(config.url, config.provider) ?? config.url;

  return (
    <div>
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={embedUrl}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={component.title}
        />
      </div>
      {config.transcript && (
        <details className="mt-2">
          <summary className="text-sm cursor-pointer text-neutral-500 hover:text-neutral-700">Transcript</summary>
          <p className="text-sm text-neutral-600 mt-1 whitespace-pre-wrap">{config.transcript}</p>
        </details>
      )}
    </div>
  );
}
