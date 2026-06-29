'use client';

import { useDroppable } from '@dnd-kit/core';
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
  const labels: Record<string, string> = {
    reflection_journal: 'Free Write',
    text_input: 'Text Input',
    rich_text: 'Rich Text',
    multiple_choice: 'Checklist',
    rating_scale: 'Sliders',
    video_embed: 'Video',
    image_embed: 'Image',
  };
  return labels[comp.componentType] || 'Mission';
}

interface ComponentPanelProps {
  readingContent?: string;
  missions: CourseComponentRecord[];
  selectedMissionId: string | null;
  currentWeek: { weekNumber: number; theme: string };
  onEditReading?: () => void;
  onSelectMission: (id: string | null) => void;
  onDeleteMission: (id: string) => void;
  onAddBlankMission: () => void;
}

export default function ComponentPanel({
  readingContent,
  missions,
  selectedMissionId,
  currentWeek,
  onEditReading,
  onSelectMission,
  onAddBlankMission,
}: ComponentPanelProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: 'missions-drop-zone',
    data: { source: 'missions-zone' },
  });

  return (
    <div className={styles.panel}>

      {/* Reading card — mirrors /course page readingCard */}
      <button type="button" className={styles.readingCard} onClick={onEditReading}>
        <span className={styles.readingAccent} aria-hidden="true" />
        <span className={styles.readingThumb} aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={styles.readingThumbIcon}>
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </span>
        <div className={styles.readingInfo}>
          <span className={styles.readingCategory}>Week {currentWeek.weekNumber}</span>
          <span className={styles.readingTitle}>{readingContent ? currentWeek.theme || 'Reading' : currentWeek.theme || 'Add reading'}</span>
        </div>
        <svg className={styles.readingArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        {missions.length === 0 && (
          <div className={styles.empty}>
            <span className={styles.emptyText}>Drop components here or add a blank mission</span>
          </div>
        )}

        {missions.map((comp, i) => {
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
                <svg className={styles.taskArrow} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </div>
          );
        })}

        <button type="button" className={styles.addBtn} onClick={onAddBlankMission}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Mission
        </button>
      </div>

    </div>
  );
}
