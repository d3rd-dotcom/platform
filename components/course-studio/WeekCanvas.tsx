'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { CourseComponentRecord } from '@/lib/vip-course-db';

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
  isFullCourse?: boolean;
}

function SortableComponent({
  component,
  isSelected,
  onSelect,
}: {
  component: CourseComponentRecord;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: component.id,
    data: { type: component.componentType, config: component.config, source: 'canvas' },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 rounded-lg border cursor-grab transition-colors ${
        isSelected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'
          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-neutral-400'
      }`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-neutral-400 text-xs shrink-0">⋮⋮</span>
          <span className="text-xs font-medium uppercase tracking-wide text-neutral-500 shrink-0">{component.componentType.replace(/_/g, ' ')}</span>
          {component.title && (
            <span className="text-sm truncate">{component.title}</span>
          )}
        </div>
        {component.required && (
          <span className="text-xs text-amber-500 font-medium shrink-0">required</span>
        )}
      </div>
    </div>
  );
}

function WeekDropZone({
  week,
  components,
  selectedComponentId,
  onSelectComponent,
}: {
  week: StudioWeek;
  components: CourseComponentRecord[];
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `week-${week.id}`,
    data: { weekId: week.id },
  });

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] rounded-lg border-2 border-dashed transition-colors p-2 space-y-2 ${
        isOver
          ? 'border-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
          : 'border-transparent'
      }`}
    >
      {components.length === 0 && (
        <p className="text-xs text-neutral-400 text-center py-8">Drop components here</p>
      )}
      <SortableContext items={components.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        {components.map((comp) => (
          <SortableComponent
            key={comp.id}
            component={comp}
            isSelected={selectedComponentId === comp.id}
            onSelect={onSelectComponent}
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
}: WeekCanvasProps) {
  const currentWeek = weeks.find((w) => w.id === selectedWeek);
  if (!currentWeek && weeks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-neutral-400">
        <p className="text-sm mb-3">No weeks yet</p>
        <button
          type="button"
          onClick={onAddWeek}
          className="px-3 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600"
        >
          + Add Week
        </button>
      </div>
    );
  }

  const displayWeek = currentWeek ?? weeks[0];

  return (
    <div>
      {/* Week tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {weeks.map((week) => (
          <button
            key={week.id}
            type="button"
            onClick={() => onSelectWeek(week.id)}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              week.id === displayWeek.id
                ? 'bg-blue-500 text-white'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700'
            }`}
          >
            {week.title || `Week ${week.weekNumber}`}
          </button>
        ))}
        <button
          type="button"
          onClick={onAddWeek}
          className="px-2 py-1.5 text-sm rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Add week"
        >
          +</button>
      </div>

      {/* Week title/theme editor */}
      <div className="flex gap-2 mb-4">
        <input
          value={displayWeek.title}
          onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
          placeholder="Week title"
          className="flex-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        />
        <input
          value={displayWeek.theme}
          onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
          placeholder="Theme (optional)"
          className="flex-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
        />
      </div>

      {/* Drop zone */}
      <WeekDropZone
        week={displayWeek}
        components={displayWeek.components}
        selectedComponentId={selectedComponentId}
        onSelectComponent={(id) => {
          onSelectComponent(id);
        }}
      />
    </div>
  );
}
