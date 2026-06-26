'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';

interface RichTextConfig {
  content?: string;
  format?: 'markdown' | 'html';
}

export default function RichTextRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as RichTextConfig;
  const content = config.content ?? '';

  if (!content) {
    return <div className="text-neutral-500 italic">No content</div>;
  }

  if (config.format === 'html') {
    return <div dangerouslySetInnerHTML={{ __html: content }} />;
  }

  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      {content.split('\n').map((line, i) => {
        if (line.startsWith('## ')) return <h2 key={i}>{line.slice(3)}</h2>;
        if (line.startsWith('# ')) return <h1 key={i}>{line.slice(2)}</h1>;
        if (line.startsWith('- ')) return <li key={i} className="ml-4">{line.slice(2)}</li>;
        if (line.trim() === '') return <br key={i} />;
        return <p key={i}>{line}</p>;
      })}
    </div>
  );
}
