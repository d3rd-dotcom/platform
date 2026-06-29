'use client';

import { useState } from 'react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import styles from './CoursePreview.module.css';

const WEEK_TITLES = [
  'Safety', 'Self-Awareness', 'Processing', 'Compassion',
  'Narrative', 'Integration', 'Resilience', 'Growth',
  'Connection', 'Purpose', 'Autonomy', 'Legacy',
];

const TASK_ACCENTS = ['#6C5CE7', '#F97316', '#22D3EE', '#F43F5E', '#A855F7', '#14B8A6', '#EAB308'];
const ARTWORK_VARIANTS = ['aurora', 'sunrise', 'orbit', 'bloom', 'ribbon', 'prism'];
const READING_ACCENT = '#6C5CE7';
const READING_THUMB_BG = 'linear-gradient(135deg, #6C5CE7 0%, #A855F7 50%, #C084FC 100%)';

function getArtworkVariant(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return ARTWORK_VARIANTS[Math.abs(hash) % ARTWORK_VARIANTS.length];
}

interface CoursePreviewProps {
  weeks: Array<{
    id: string;
    weekNumber: number;
    title: string;
    theme: string;
    components: CourseComponentRecord[];
  }>;
  readingContent: string;
  title: string;
}

export default function CoursePreview({ weeks, readingContent, title }: CoursePreviewProps) {
  const [viewWeek, setViewWeek] = useState(1);
  const [rightContent, setRightContent] = useState<'reading' | 'task' | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const week = weeks.find((w) => w.weekNumber === viewWeek);
  const components = week?.components ?? [];

  const weekReadingIndex = Math.min(viewWeek - 1, weeks.length - 1);
  const weekLabel = WEEK_TITLES[weekReadingIndex] ?? `Week ${viewWeek}`;

  return (
    <div className={styles.preview}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.courseTitle}>{title}</h1>
        <span className={styles.previewBadge}>Preview</span>
      </div>

      {/* Week navigation */}
      <div className={styles.weekNav}>
        <button
          className={styles.weekNavArrow}
          onClick={() => { const n = Math.max(1, viewWeek - 1); setViewWeek(n); setRightContent(null); }}
          disabled={viewWeek <= 1}
          aria-label="Previous week"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>

        <div className={styles.weekDots}>
          {weeks.map((w) => (
            <button
              key={w.id}
              className={`${styles.weekDot} ${viewWeek === w.weekNumber ? styles.weekDotActive : ''}`}
              onClick={() => { setViewWeek(w.weekNumber); setRightContent(null); }}
              title={`Week ${w.weekNumber}: ${WEEK_TITLES[w.weekNumber - 1] ?? ''}`}
            >
              <span className={styles.weekDotInner} />
            </button>
          ))}
        </div>

        <button
          className={styles.weekNavArrow}
          onClick={() => { const n = Math.min(weeks.length, viewWeek + 1); setViewWeek(n); setRightContent(null); }}
          disabled={viewWeek >= weeks.length}
          aria-label="Next week"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Main content */}
      <div className={styles.body}>
        {/* Left column — mirrors /course left column */}
        <div className={styles.leftCol}>
          {/* Reading card */}
          <button
            type="button"
            className={`${styles.readingCard} ${rightContent === 'reading' ? styles.readingCardActive : ''}`}
            onClick={() => { setRightContent('reading'); setSelectedTaskId(null); }}
          >
            <span className={styles.readingAccent} style={{ background: READING_ACCENT }} aria-hidden="true" />
            <span className={styles.readingThumb} style={{ background: READING_THUMB_BG }} aria-hidden="true" />
            <div className={styles.readingInfo}>
              <span className={styles.readingCategory}>{weekLabel}</span>
              <span className={styles.readingTitle}>Weekly Read</span>
            </div>
            <svg className={styles.readingArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>

          {/* Missions heading */}
          <div className={styles.missionsHeadingRow} aria-hidden="true">
            <span className={styles.missionsDivider} />
            <h2 className={styles.missionsHeading}>Missions</h2>
            <span className={styles.missionsDivider} />
          </div>

          {/* Task cards */}
          <div className={styles.tasksList}>
            {components.length === 0 && (
              <p className={styles.emptyText}>No missions in this week yet</p>
            )}
            {components.map((c, i) => {
              const accent = TASK_ACCENTS[i % TASK_ACCENTS.length];
              const variant = getArtworkVariant(c.id);
              const isSelected = rightContent === 'task' && selectedTaskId === c.id;

              return (
                <button
                  key={c.id}
                  type="button"
                  className={`${styles.taskCard} ${isSelected ? styles.taskCardActive : ''}`}
                  onClick={() => { setSelectedTaskId(c.id); setRightContent('task'); }}
                >
                  <span className={styles.taskAccent} style={{ background: accent }} aria-hidden="true" />
                  <span
                    className={`${styles.taskArtwork} ${styles[`taskArtwork${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''}`}
                    style={{ '--task-accent': accent } as React.CSSProperties}
                    aria-hidden="true"
                  />
                  <span className={styles.taskTitle}>{c.title || 'Untitled'}</span>
                  <svg className={styles.taskArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right panel — desktop only preview */}
        <div className={styles.rightPanel}>
          {rightContent === 'reading' && (
            <div className={styles.readerPanel}>
              <div className={styles.readerPanelHeader}>
                <span className={styles.readerLabel}>Weekly Read</span>
                <span className={styles.readerTheme}>{weekLabel}</span>
              </div>
              <div className={styles.readerBody}>
                {readingContent ? (
                  <div className={styles.readerHtml} dangerouslySetInnerHTML={{ __html: readingContent }} />
                ) : (
                  <p className={styles.readerEmpty}>No reading content yet</p>
                )}
              </div>
            </div>
          )}

          {rightContent === 'task' && selectedTaskId && (
            <div className={styles.taskDetail}>
              {(() => {
                const c = components.find((x) => x.id === selectedTaskId);
                if (!c) return null;
                const i = components.indexOf(c);
                const accent = TASK_ACCENTS[i % TASK_ACCENTS.length];
                const variant = getArtworkVariant(c.id);
                return (
                  <>
                    <div className={styles.taskDetailHeader}>
                      <span className={styles.taskDetailAccent} style={{ background: accent }} aria-hidden="true" />
                      <span
                        className={`${styles.taskArtwork} ${styles[`taskArtwork${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''}`}
                        style={{ '--task-accent': accent } as React.CSSProperties}
                        aria-hidden="true"
                      />
                      <span className={styles.taskDetailTitle}>{c.title || 'Untitled'}</span>
                    </div>
                    <div className={styles.taskDetailBody}>
                      <ComponentRenderer component={c as any} />
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {!rightContent && (
            <div className={styles.rightPanelEmpty}>
              <p>Select a reading or mission to preview</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
