'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import dynamic from 'next/dynamic';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './WeekCanvas.module.css';

const ComponentRenderer = dynamic(() => import('@/components/course-renderers/ComponentRenderer'), { ssr: false });

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
}

const TYPE_COLORS: Record<string, string> = {
  rich_text: '#B85C38',
  multiple_choice: '#9370DB',
  dropdown: '#20B2AA',
  image_embed: '#FF6B6B',
  video_embed: '#4ECDC4',
  file_upload: '#DEB887',
  text_input: '#95E1D3',
  rating_scale: '#FFD700',
  reflection_journal: '#F08080',
  quiz_block: '#FFA500',
  markdown_file: '#A9A9A9',
};

const TYPE_ICONS: Record<string, string> = {
  rich_text: '📖',
  multiple_choice: '🚪',
  dropdown: '⬇️',
  image_embed: '🖼️',
  video_embed: '💎',
  file_upload: '📦',
  text_input: '⌨️',
  rating_scale: '⭐',
  reflection_journal: '✍️',
  quiz_block: '❓',
  markdown_file: '📄',
};

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

  const color = TYPE_COLORS[component.componentType] ?? '#666';
  const icon = TYPE_ICONS[component.componentType] ?? '❓';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.component} ${isSelected ? styles.componentSelected : ''} ${isDragging ? styles.componentDragging : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
    >
      {/* Drag handle + toolbar */}
      <div className={styles.componentToolbar} style={{ background: color }}>
        <div className={styles.toolbarLeft}>
          <span className={styles.dragHandle} {...attributes} {...listeners}>
            ⋮⋮
          </span>
          <span className={styles.toolbarIcon}>{icon}</span>
          <span className={styles.toolbarType}>{component.componentType.replace(/_/g, ' ')}</span>
          {component.title && (
            <span className={styles.toolbarTitle}>{component.title}</span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          {component.required && <span className={styles.requiredBadge}>required</span>}
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}
            title="Delete component"
          >
            ✕
          </button>
        </div>
      </div>

      {/* WYSIWYG rendered content */}
      <div className={styles.componentPreview}>
        <ComponentRenderer component={component} />
      </div>
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
        <p className={styles.dropZoneEmpty}>
          Drag blocks from the Item Shop to build your course
        </p>
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
          + Add Week
        </button>
      </div>
    );
  }

  const displayWeek = currentWeek ?? weeks[0];

  return (
    <div>
      {/* Week tabs */}
      <div className={styles.tabs}>
        {weeks.map((week) => (
          <button
            key={week.id}
            type="button"
            onClick={() => onSelectWeek(week.id)}
            className={`${styles.tab} ${week.id === displayWeek.id ? styles.tabActive : styles.tabInactive}`}
          >
            {week.title || `Week ${week.weekNumber}`}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddWeek}
          className={styles.addTab}
          title="Add week"
        >
          +
        </button>
      </div>

      {/* Week title/theme editor */}
      <div className={styles.weekEditor}>
        <input
          value={displayWeek.title}
          onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
          placeholder="Week title"
          className={styles.weekInput}
        />
        <input
          value={displayWeek.theme}
          onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
          placeholder="Theme (optional)"
          className={styles.weekInput}
        />
      </div>

      {/* Drop zone with WYSIWYG components */}
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
