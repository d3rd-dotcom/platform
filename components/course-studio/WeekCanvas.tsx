'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TextT,
  CheckSquare,
  CaretDown,
  Image,
  Video,
  UploadSimple,
  Keyboard,
  Star,
  NotePencil,
  Question,
  FileText,
  Plus,
  DotsSixVertical,
  Trash,
  ArrowLeft,
  ArrowRight,
} from '@phosphor-icons/react';
import type { CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';
import styles from './WeekCanvas.module.css';

const COMPONENT_ICONS: Record<ComponentType, React.ReactNode> = {
  rich_text: <TextT size={18} weight="bold" />,
  multiple_choice: <CheckSquare size={18} weight="bold" />,
  dropdown: <CaretDown size={18} weight="bold" />,
  image_embed: <Image size={18} weight="bold" />,
  video_embed: <Video size={18} weight="bold" />,
  file_upload: <UploadSimple size={18} weight="bold" />,
  text_input: <Keyboard size={18} weight="bold" />,
  rating_scale: <Star size={18} weight="bold" />,
  reflection_journal: <NotePencil size={18} weight="bold" />,
  quiz_block: <Question size={18} weight="bold" />,
  markdown_file: <FileText size={18} weight="bold" />,
};

const COMPONENT_LABELS: Record<ComponentType, string> = {
  rich_text: 'Rich Text',
  multiple_choice: 'Multiple Choice',
  dropdown: 'Dropdown',
  image_embed: 'Image',
  video_embed: 'Video',
  file_upload: 'File Upload',
  text_input: 'Text Input',
  rating_scale: 'Rating',
  reflection_journal: 'Journal',
  quiz_block: 'Quiz',
  markdown_file: 'Markdown',
};

interface StudioWeek {
  id: string;
  weekNumber: number;
  title: string;
  theme: string;
  components: CourseComponentRecord[];
}

interface WeekCanvasProps {
  weeks: StudioWeek[];
  selectedWeek: string;
  onSelectWeek: (weekId: string) => void;
  onSelectComponent: (compId: string | null) => void;
  selectedComponentId: string | null;
  onAddWeek: () => void;
  onUpdateWeek: (weekId: string, updates: { title?: string; theme?: string }) => void;
  onDeleteComponent: (compId: string) => void;
  onUpdateComponent: (compId: string, updates: Partial<CourseComponentRecord>) => void;
}

function WysiwygComponent({
  component,
  isSelected,
  onSelect,
  onDelete,
}: {
  component: CourseComponentRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { type: component.componentType, config: component.config, source: 'canvas' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasConfig = component.config && Object.keys(component.config).length > 0;
  const hasTitle = !!component.title;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${isDragging ? styles.cardDragging : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
    >
      <div className={styles.cardHandle} {...attributes} {...listeners}>
        <DotsSixVertical size={12} weight="bold" />
      </div>

      <span className={styles.cardIcon}>
        {COMPONENT_ICONS[component.componentType]}
      </span>

      <div className={styles.cardInfo}>
        <span className={styles.cardType}>
          {COMPONENT_LABELS[component.componentType]}
        </span>
        {hasTitle && (
          <span className={styles.cardTitle}>{component.title}</span>
        )}
        {!hasTitle && !hasConfig && (
          <span className={styles.cardEmpty}>Tap to add content</span>
        )}
        {!hasTitle && hasConfig && (
          <span className={styles.cardFilled}>Has content</span>
        )}
      </div>

      <button
        type="button"
        className={styles.cardDelete}
        onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}
        title="Remove component"
      >
        <Trash size={12} weight="bold" />
      </button>
    </div>
  );
}

function WeekDropZone({
  week,
  components,
  selectedComponentId,
  onSelectComponent,
  onDeleteComponent,
}: {
  week: StudioWeek;
  components: CourseComponentRecord[];
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onDeleteComponent: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-${week.id}`,
    data: { weekId: week.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.dropZone} ${isOver ? styles.dropZoneOver : ''}`}
    >
      {components.length === 0 && (
        <div className={styles.dropZoneEmpty}>
          <span className={styles.dropZoneEmptyIcon}>
            <Plus size={20} weight="bold" />
          </span>
          <span className={styles.dropZoneEmptyText}>Drag components here or use the palette</span>
        </div>
      )}
      <SortableContext items={components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {components.map((comp) => (
          <WysiwygComponent
            key={comp.id}
            component={comp}
            isSelected={selectedComponentId === comp.id}
            onSelect={onSelectComponent}
            onDelete={onDeleteComponent}
          />
        ))}
      </SortableContext>
    </div>
  );
}

export default function WeekCanvas({
  weeks,
  selectedWeek,
  onSelectWeek,
  onSelectComponent,
  selectedComponentId,
  onAddWeek,
  onUpdateWeek,
  onDeleteComponent,
}: WeekCanvasProps) {
  const currentWeek = weeks.find((w) => w.id === selectedWeek);
  if (!currentWeek && weeks.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No weeks yet</p>
        <button type="button" onClick={onAddWeek} className={styles.addWeekBtn}>
          <Plus size={14} weight="bold" />
          Add Week
        </button>
      </div>
    );
  }

  const displayWeek = currentWeek ?? weeks[0];
  const currentIndex = weeks.findIndex((w) => w.id === displayWeek.id);

  return (
    <div className={styles.canvasInner}>
      {/* Week nav — dot style like /course */}
      <div className={styles.weekNav}>
        <button
          type="button"
          className={styles.weekNavArrow}
          onClick={() => {
            const idx = Math.max(0, currentIndex - 1);
            onSelectWeek(weeks[idx].id);
          }}
          disabled={currentIndex <= 0}
          aria-label="Previous week"
        >
          <ArrowLeft size={14} weight="bold" />
        </button>

        <div className={styles.weekNavDots}>
          {weeks.map((week, i) => (
            <button
              key={week.id}
              type="button"
              className={`${styles.weekDot} ${week.id === displayWeek.id ? styles.weekDotActive : ''}`}
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

        <button
          type="button"
          className={styles.weekNavArrow}
          onClick={() => {
            const idx = Math.min(weeks.length - 1, currentIndex + 1);
            onSelectWeek(weeks[idx].id);
          }}
          disabled={currentIndex >= weeks.length - 1}
          aria-label="Next week"
        >
          <ArrowRight size={14} weight="bold" />
        </button>

        <span className={styles.weekNavLabel}>
          {displayWeek.title || `Week ${displayWeek.weekNumber}`}
        </span>
      </div>

      {/* Week theme input */}
      <div className={styles.weekMeta}>
        <input
          value={displayWeek.title}
          onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
          placeholder="Week title"
          className={styles.weekTitleInput}
        />
        <input
          value={displayWeek.theme}
          onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
          placeholder="Theme (optional)"
          className={styles.weekThemeInput}
        />
      </div>

      {/* Missions heading row — like /course */}
      <div className={styles.missionsHeadingRow} aria-hidden="true">
        <span className={styles.missionsDivider} />
        <h2 className={styles.missionsHeading}>Components</h2>
        <span className={styles.missionsDivider} />
      </div>

      {/* Drop zone with components */}
      <WeekDropZone
        week={displayWeek}
        components={displayWeek.components}
        selectedComponentId={selectedComponentId}
        onSelectComponent={onSelectComponent}
        onDeleteComponent={onDeleteComponent}
      />
    </div>
  );
}
