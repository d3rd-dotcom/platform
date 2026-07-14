'use client';

import Image from 'next/image';
import { useDroppable } from '@dnd-kit/core';
import {
  Plus,
  CaretLeft,
  CaretRight,
  Trash,
  BookOpen,
  TextT,
  ListChecks,
  Star,
  LockSimple,
  VideoCamera,
  ImageSquare,
  MonitorPlay,
  PencilSimpleLine,
  StackSimple,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ComponentPanel.module.css';

const BLOCK_LABELS: Record<string, string> = {
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

const BLOCK_ICONS: Record<string, Icon> = {
  reflection_journal: PencilSimpleLine,
  text_input: TextT,
  rich_text: TextT,
  multiple_choice: ListChecks,
  rating_scale: Star,
  nft_gate: LockSimple,
  video_embed: VideoCamera,
  image_embed: ImageSquare,
  media_embed: MonitorPlay,
};

function getMissionType(comp: CourseComponentRecord): string {
  if (comp.componentType === 'mission_container') {
    return comp.blocks?.[0]?.blockType ?? 'mission_container';
  }
  return comp.componentType;
}

function getMissionLabel(comp: CourseComponentRecord): string {
  if (comp.title) return comp.title;
  return BLOCK_LABELS[getMissionType(comp)] || 'Mission';
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
      {/* Weeks header — label + count on the left, actions on the right */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabelGroup}>
          <span className={styles.sectionLabel}>Weeks</span>
          <span className={styles.countBadge}>{weeks.length}</span>
        </div>
        <div className={styles.sectionActions}>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
            onClick={() => onDeleteWeek(selectedWeekId)}
            disabled={weeks.length <= 1}
            title="Delete week"
          >
            <Trash size={13} />
          </button>
          <span className={styles.actionDivider} aria-hidden="true" />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              const idx = Math.max(0, currentIndex - 1);
              onSelectWeek(weeks[idx].id);
            }}
            disabled={!displayWeek || currentIndex <= 0}
            aria-label="Previous week"
          >
            <CaretLeft size={13} />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              const idx = Math.min(weeks.length - 1, currentIndex + 1);
              onSelectWeek(weeks[idx].id);
            }}
            disabled={!displayWeek || currentIndex >= weeks.length - 1}
            aria-label="Next week"
          >
            <CaretRight size={13} />
          </button>
        </div>
      </div>

      {/* Week chips — direct selection plus add */}
      <div className={styles.weekChips}>
        {weeks.map((week) => (
          <button
            key={week.id}
            type="button"
            className={`${styles.weekChip} ${week.id === selectedWeekId ? styles.weekChipActive : ''}`}
            onClick={() => onSelectWeek(week.id)}
            title={week.title || `Week ${week.weekNumber}`}
          >
            {week.weekNumber}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddWeek}
          className={styles.weekChipAdd}
          title="Add week"
        >
          <Plus size={11} weight="bold" />
        </button>
      </div>

      {/* Week meta — theme, title */}
      {displayWeek && (
        <div className={styles.weekMetaStack}>
          <div className={styles.weekMetaRow}>
            <span className={styles.fieldBadge}>Theme</span>
            <input
              value={displayWeek.theme}
              onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
              onKeyDown={() => play('click')}
              placeholder="Shows as eyebrow text"
              className={styles.weekInput}
            />
          </div>
          <div className={styles.weekMetaRow}>
            <span className={styles.fieldBadge}>Title</span>
            <input
              value={displayWeek.title}
              onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
              onKeyDown={() => play('click')}
              placeholder="Name this week"
              className={`${styles.weekInput} ${styles.weekInputTitle}`}
            />
          </div>
        </div>
      )}

      {/* Reading row */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabelGroup}>
          <span className={styles.sectionLabel}>Weekly read</span>
          {readingContent ? (
            <span className={`${styles.stateBadge} ${styles.stateBadgeSet}`}>Ready</span>
          ) : (
            <span className={styles.stateBadge}>Empty</span>
          )}
        </div>
      </div>
      <button type="button" className={styles.readingRow} onClick={onEditReading}>
        <span className={styles.rowIcon} aria-hidden="true">
          {readingImageUrl ? (
            <Image src={readingImageUrl} alt="" fill sizes="28px" unoptimized className={styles.rowIconImg} />
          ) : (
            <BookOpen size={15} />
          )}
        </span>
        <div className={styles.rowInfo}>
          <span className={styles.rowTitle}>{displayWeek.title || (readingContent ? 'Reading' : 'Add reading')}</span>
          {displayWeek.theme && <span className={styles.rowSub}>{displayWeek.theme}</span>}
        </div>
        <CaretRight size={13} className={styles.rowChevron} />
      </button>

      {/* Missions header */}
      <div className={styles.sectionHeader}>
        <div className={styles.sectionLabelGroup}>
          <span className={styles.sectionLabel}>Missions</span>
          <span className={styles.countBadge}>{missions.length}</span>
        </div>
        <div className={styles.sectionActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => { play('click'); onAddBlankMission(); }}
            title="Add mission"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {/* Droppable missions zone */}
      <div
        ref={setNodeRef}
        className={`${styles.missionsZone} ${isOver ? styles.missionsZoneOver : ''}`}
      >
        {missions.map((comp) => {
          const TypeIcon = BLOCK_ICONS[getMissionType(comp)] ?? StackSimple;
          return (
            <div
              key={comp.id}
              className={`${styles.missionRow} ${comp.id === selectedMissionId ? styles.missionRowSelected : ''}`}
              onClick={() => onSelectMission(comp.id)}
            >
              <span className={styles.rowIcon} aria-hidden="true">
                <TypeIcon size={15} />
              </span>
              <div className={styles.rowInfo}>
                <span className={styles.rowTitle}>{getMissionLabel(comp)}</span>
              </div>
              {comp.componentType === 'mission_container' && comp.blocks && comp.blocks.length > 0 && (
                <span className={styles.countBadge}>{comp.blocks.length}</span>
              )}
              <button
                type="button"
                className={`${styles.iconBtn} ${styles.iconBtnDanger} ${styles.rowDelete}`}
                onClick={(e) => { e.stopPropagation(); onDeleteMission(comp.id); }}
                title="Delete mission"
              >
                <Trash size={13} />
              </button>
              <CaretRight size={13} className={styles.rowChevron} />
            </div>
          );
        })}

        <button
          type="button"
          className={`${styles.addBtn} ${missions.length === 0 ? styles.addBtnTall : ''}`}
          onClick={() => { play('click'); onAddBlankMission(); }}
        >
          <Plus size={13} weight="bold" />
          Add mission
        </button>
      </div>

    </div>
  );
}
