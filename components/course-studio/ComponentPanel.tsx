'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { useDroppable } from '@dnd-kit/core';
import { Plus, ArrowLeft, ArrowRight, Trash } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ComponentPanel.module.css';

const TASK_ACCENTS = [
  '#5168FF', '#7C8FFF', '#8B5CF6', '#A855F7',
  '#38BDF8', '#22D3EE', '#2DD4BF', '#34D399',
];

function getTaskArtwork(index: number): string {
  const variants = ['aurora', 'sunrise', 'orbit', 'bloom', 'ribbon', 'prism'];
  return variants[index % variants.length];
}

function getMissionLabel(comp: CourseComponentRecord): string {
  if (comp.title) return comp.title;
  if (comp.componentType === 'mission_container') {
    const labels: Record<string, string> = {
      reflection_journal: 'Field Notes',
      text_input: 'Text Input',
      rich_text: 'Rich Text',
      multiple_choice: 'Multiple Choice',
      rating_scale: 'Rating Scale',
      nft_gate: 'NFT Gate',
      video_embed: 'Video',
      image_embed: 'Image',
      media_embed: 'Media',
    };
    const firstBlock = comp.blocks?.[0];
    if (firstBlock && labels[firstBlock.blockType]) {
      return labels[firstBlock.blockType];
    }
    return 'Mission';
  }
  const labels: Record<string, string> = {
    reflection_journal: 'Field Notes',
    text_input: 'Text Input',
    rich_text: 'Rich Text',
    multiple_choice: 'Multiple Choice',
    rating_scale: 'Rating Scale',
    nft_gate: 'NFT Gate',
    video_embed: 'Video',
    image_embed: 'Image',
    media_embed: 'Media',
  };
  return labels[comp.componentType] || 'Mission';
}

interface StudioWeek {
  id: string;
  weekNumber: number;
  title: string;
  theme: string;
  components: CourseComponentRecord[];
}

interface ComponentPanelProps {
  weeks: StudioWeek[];
  selectedWeekId: string;
  onSelectWeek: (weekId: string) => void;
  onAddWeek: () => void;
  onDeleteWeek: (weekId: string) => void;
  onUpdateWeek: (weekId: string, updates: { title?: string; theme?: string }) => void;
  readingContent?: string;
  readingImageUrl?: string;
  missions: CourseComponentRecord[];
  selectedMissionId: string | null;
  onEditReading?: () => void;
  onSelectMission: (id: string | null) => void;
  onDeleteMission: (id: string) => void;
  onAddBlankMission: () => void;
}

export default function ComponentPanel({
  weeks,
  selectedWeekId,
  onSelectWeek,
  onAddWeek,
  onDeleteWeek,
  onUpdateWeek,
  readingContent,
  readingImageUrl,
  missions,
  selectedMissionId,
  onEditReading,
  onSelectMission,
  onDeleteMission,
  onAddBlankMission,
}: ComponentPanelProps) {
  const { play } = useSound();
  const { setNodeRef, isOver } = useDroppable({
    id: 'missions-drop-zone',
    data: { source: 'missions-zone' },
  });

  const displayWeek = weeks.find((w) => w.id === selectedWeekId) ?? weeks[0];
  const currentIndex = weeks.findIndex((w) => w.id === displayWeek?.id);

  return (
    <div className={styles.panel}>
      {/* Week navigation — dots on the left, arrows + delete on the right */}
      <div className={styles.weekNav}>
        <div className={styles.weekNavLeft}>
          <div className={styles.weekNavDots}>
            {weeks.map((week) => (
              <button
                key={week.id}
                type="button"
                className={`${styles.weekDot} ${week.id === selectedWeekId ? styles.weekDotActive : ''}`}
                onClick={() => onSelectWeek(week.id)}
                title={week.title || `Week ${week.weekNumber}`}
              />
            ))}
            <button
              type="button"
              onClick={onAddWeek}
              className={styles.weekDotAdd}
              title="Add week"
            >
              <Plus size={10} weight="bold" />
            </button>
          </div>
        </div>

        <div className={styles.weekNavRight}>
          <button
            type="button"
            className={styles.weekNavDelete}
            onClick={() => onDeleteWeek(selectedWeekId)}
            disabled={weeks.length <= 1}
            title="Delete week"
          >
            <Trash size={13} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.weekNavArrow}
            onClick={() => {
              const idx = Math.max(0, currentIndex - 1);
              onSelectWeek(weeks[idx].id);
            }}
            disabled={!displayWeek || currentIndex <= 0}
            aria-label="Previous week"
          >
            <ArrowLeft size={14} weight="bold" />
          </button>
          <button
            type="button"
            className={styles.weekNavArrow}
            onClick={() => {
              const idx = Math.min(weeks.length - 1, currentIndex + 1);
              onSelectWeek(weeks[idx].id);
            }}
            disabled={!displayWeek || currentIndex >= weeks.length - 1}
            aria-label="Next week"
          >
            <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </div>

      {/* Week meta — theme, title */}
      {displayWeek && (
        <input
          value={displayWeek.theme}
          onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
          onKeyDown={() => play('click')}
          placeholder="Theme — shows as eyebrow text"
          className={styles.weekThemeInput}
        />
      )}
      {displayWeek && (
        <div className={styles.weekMeta}>
          <span className={styles.weekBadge}>Title</span>
          <input
            value={displayWeek.title}
            onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
            onKeyDown={() => play('click')}
            placeholder="Name this week"
            className={styles.weekTitleInput}
          />
        </div>
      )}

      {/* Reading card — compact style matching CoursePreview */}
      <button type="button" className={styles.readingCard} onClick={onEditReading}>
        <span className={styles.readingAccent} aria-hidden="true" />
        <span className={styles.readingThumb} aria-hidden="true">
          {readingImageUrl ? (
            <Image src={readingImageUrl} alt="" fill sizes="48px" unoptimized className={styles.readingThumbImg} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.readingThumbIcon}>
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          )}
        </span>
        <div className={styles.readingInfo}>
          <span className={styles.readingCategory}>{displayWeek.theme || 'Reading'}</span>
          <span className={styles.readingTitle}>{readingContent ? displayWeek.title || 'Reading' : displayWeek.title || 'Add reading'}</span>
        </div>
        <svg className={styles.readingArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {/* Missions heading — mirrors /course page */}
      <div className={styles.missionsHeadingRow} aria-hidden="true">
        <span className={styles.missionsDivider} />
        <h2 className={styles.missionsHeading}>Missions</h2>
        <span className={styles.missionsDivider} />
      </div>

      {/* Droppable missions zone */}
      <div
        ref={setNodeRef}
        className={`${styles.missionsZone} ${isOver ? styles.missionsZoneOver : ''}`}
      >
        {missions.length > 0 && missions.map((comp, i) => {
          const accent = TASK_ACCENTS[i % TASK_ACCENTS.length];
          const artworkVariant = getTaskArtwork(i + 1);
          return (
            <div
              key={comp.id}
              className={`${styles.taskCard} ${comp.id === selectedMissionId ? styles.taskCardSelected : ''}`}
              onClick={() => onSelectMission(comp.id)}
              style={{ '--task-accent': accent } as React.CSSProperties}
            >
              <div className={styles.taskCardHeader}>
                <span className={styles.taskAccent} aria-hidden="true" />
                <span className={`${styles.taskArtwork} ${styles[`taskArtwork${artworkVariant.charAt(0).toUpperCase() + artworkVariant.slice(1)}`] || ''}`} aria-hidden="true" />
                <span className={styles.taskTitle}>{getMissionLabel(comp)}</span>
                {comp.componentType === 'mission_container' && comp.blocks && comp.blocks.length > 0 && (
                  <span className={styles.blockCount}>{comp.blocks.length} block{comp.blocks.length !== 1 ? 's' : ''}</span>
                )}
                <button
                  type="button"
                  className={styles.taskDelete}
                  onClick={(e) => { e.stopPropagation(); onDeleteMission(comp.id); }}
                  title="Delete mission"
                >
                  <Trash size={13} weight="bold" />
                </button>
                <svg className={styles.taskArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          className={`${styles.addBtn} ${missions.length === 0 ? styles.addBtnTall : ''}`}
          onClick={() => { play('click'); onAddBlankMission(); }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Mission
        </button>
      </div>

    </div>
  );
}
