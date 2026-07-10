'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './RichTextRenderer.module.css';

interface RichTextConfig {
  content?: string;
  format?: 'markdown' | 'html';
}

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(?:href|src|action|formaction)\s*=\s*"javascript:[^"]*"/gi, 'href="#"')
    .replace(/(?:href|src|action|formaction)\s*=\s*'javascript:[^']*'/gi, "href='#'")
    .replace(/(?:href|src|action|formaction)\s*=\s*javascript:[^\s>]+/gi, 'href="#"');
}

function transformMarkdownUrl(url: string): string {
  return /^(?:https?:|mailto:|tel:|\/|#)/i.test(url) ? url : '';
}

export default function RichTextRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as RichTextConfig;
  const content = config.content ?? '';

  if (!content) {
    return <div className={styles.empty_state}>No content</div>;
  }

  if (config.format === 'html' || /<[a-z][\s\S]*>/i.test(content)) {
    return <div className={styles.html_container} dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }} />;
  }

  return (
    <div className={styles.prose_container}>
      <ReactMarkdown urlTransform={transformMarkdownUrl}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
