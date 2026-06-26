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
  onUpdateComponent: (compId: string, updates: Partial<CourseComponentRecord>) => void;
}

function WysiwygComponent({
  component,
  isSelected,
  onSelect,
  onDelete,
  onComponentUpdate,
}: {
  component: CourseComponentRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onComponentUpdate?: (id: string, updates: Partial<CourseComponentRecord>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { type: component.componentType, config: component.config, source: 'canvas' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${isDragging ? styles.cardDragging : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
    >
      {/* Drag handle — only visible on hover */}
      <div className={styles.handle} {...attributes} {...listeners}>
        <span className={styles.handleIcon}>⋮⋮</span>
      </div>

      {/* Delete button — only visible on hover */}
      <button
        type="button"
        className={styles.deleteBtn}
        onClick={(e) => { e.stopPropagation(); onDelete(component.id); }}
        title="Remove component"
      >
        ✕
      </button>

      {/* Match CourseModule .component_card exactly */}
      <div className={styles.cardBody}>
        {component.title && (
          <h3 className={styles.cardTitle}>{component.title}</h3>
        )}
        <ComponentRenderer
          component={component}
          onComponentUpdate={(updates) => onComponentUpdate?.(component.id, updates)}
        />
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
  onComponentUpdate,
}: {
  week: StudioWeek;
  components: CourseComponentRecord[];
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onDeleteComponent: (id: string) => void;
  onComponentUpdate?: (id: string, updates: Partial<CourseComponentRecord>) => void;
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
            onComponentUpdate={onComponentUpdate}
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
  onUpdateComponent,
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
        onComponentUpdate={onUpdateComponent}
      />
    </div>
  );
}
