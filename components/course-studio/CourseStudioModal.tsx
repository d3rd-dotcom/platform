'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import ComponentPalette from './ComponentPalette';
import WeekCanvas from './WeekCanvas';
import ComponentInspector from './ComponentInspector';
import type { VipCourseFull, CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';

interface CourseStudioModalProps {
  authHeaders: () => Promise<HeadersInit>;
  onClose: () => void;
  onCourseCreated: () => void;
  existingCourseId?: string;
}

type CourseDraft = {
  weeks: Array<{
    id: string;
    weekNumber: number;
    title: string;
    theme: string;
    components: CourseComponentRecord[];
  }>;
};

function createBlankWeek(weekNumber: number): {
  id: string;
  weekNumber: number;
  title: string;
  theme: string;
  components: CourseComponentRecord[];
} {
  return {
    id: `temp-${Date.now()}-${weekNumber}`,
    weekNumber,
    title: `Week ${weekNumber}`,
    theme: '',
    components: [],
  };
}

export default function CourseStudioModal({
  authHeaders,
  onClose,
  onCourseCreated,
  existingCourseId,
}: CourseStudioModalProps) {
  const [phase, setPhase] = useState<'loading' | 'edit' | 'saving'>('loading');
  const [courseId, setCourseId] = useState<string | null>(existingCourseId ?? null);
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [slug, setSlug] = useState('');
  const [weeks, setWeeks] = useState<CourseDraft['weeks']>([createBlankWeek(1)]);
  const [selectedWeekId, setSelectedWeekId] = useState(weeks[0]?.id ?? '');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{ type: ComponentType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const selectedComponent = selectedComponentId
    ? weeks.flatMap((w) => w.components).find((c) => c.id === selectedComponentId) ?? null
    : null;

  // Load existing course
  useEffect(() => {
    if (!existingCourseId) { setPhase('edit'); return; }
    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch(`/api/vip/courses/${existingCourseId}`, { headers });
        const data = await res.json();
        const course: VipCourseFull = data.course;
        setTitle(course.title);
        setFocus(course.focus);
        setSlug(course.slug);
        setCourseId(course.id);
        const mapped = course.weeks.map((w) => ({
          id: w.id,
          weekNumber: w.weekNumber,
          title: w.title,
          theme: w.theme,
          components: w.components,
        }));
        setWeeks(mapped.length ? mapped : [createBlankWeek(1)]);
        setSelectedWeekId(mapped[0]?.id ?? '');
        setPhase('edit');
      } catch {
        setError('Failed to load course.');
        setPhase('edit');
      }
    })();
  }, [existingCourseId, authHeaders]);

  const updateWeek = (weekId: string, updates: { title?: string; theme?: string }) => {
    setWeeks((prev) =>
      prev.map((w) => (w.id === weekId ? { ...w, ...updates } : w)),
    );
    setDirty(true);
  };

  // Generate a temporary ID for new components on the client
  const tempId = () => `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const addComponentToWeek = (weekId: string, type: ComponentType, config?: Record<string, unknown>) => {
    const newComp: CourseComponentRecord = {
      id: tempId(),
      weekId,
      sortOrder: weeks.find((w) => w.id === weekId)?.components.length ?? 0,
      componentType: type,
      title: '',
      config: config ?? {},
      required: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setWeeks((prev) =>
      prev.map((w) => (w.id === weekId ? { ...w, components: [...w.components, newComp] } : w)),
    );
    setSelectedComponentId(newComp.id);
    setDirty(true);
  };

  const updateComponent = (compId: string, updates: Partial<CourseComponentRecord>) => {
    setWeeks((prev) =>
      prev.map((w) => ({
        ...w,
        components: w.components.map((c) => (c.id === compId ? { ...c, ...updates } : c)),
      })),
    );
    setDirty(true);
  };

  const deleteComponent = (compId: string) => {
    setWeeks((prev) =>
      prev.map((w) => ({
        ...w,
        components: w.components.filter((c) => c.id !== compId),
      })),
    );
    setSelectedComponentId(null);
    setDirty(true);
  };

  const addWeek = () => {
    const nextNumber = weeks.length + 1;
    const newWeek = createBlankWeek(nextNumber);
    setWeeks((prev) => [...prev, newWeek]);
    setSelectedWeekId(newWeek.id);
    setDirty(true);
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === 'palette') {
      setActiveDragItem({ type: data.type as ComponentType });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Dragging from palette onto a week drop zone
    if (activeData?.source === 'palette' && overData?.weekId) {
      addComponentToWeek(overData.weekId, activeData.type as ComponentType);
      return;
    }

    // Dragging from palette onto a component (add to that component's week)
    if (activeData?.source === 'palette' && overData?.type) {
      const targetWeek = weeks.find((w) => w.components.some((c) => c.id === over.id));
      if (targetWeek) {
        addComponentToWeek(targetWeek.id, activeData.type as ComponentType);
      }
      return;
    }

    // Reordering within a week
    const activeWeek = weeks.find((w) => w.components.some((c) => c.id === active.id));
    const overWeek = weeks.find((w) => w.components.some((c) => c.id === over.id));

    if (activeWeek && activeWeek.id === overWeek?.id) {
      const oldIndex = activeWeek.components.findIndex((c) => c.id === active.id);
      const newIndex = activeWeek.components.findIndex((c) => c.id === over.id);
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(activeWeek.components, oldIndex, newIndex);
        setWeeks((prev) =>
          prev.map((w) =>
            w.id === activeWeek.id
              ? { ...w, components: reordered.map((c, i) => ({ ...c, sortOrder: i })) }
              : w,
          ),
        );
        setDirty(true);
      }
    }
  };

  const saveCourse = async () => {
    setError(null);
    setPhase('saving');
    try {
      const headers = await authHeaders();

      if (courseId) {
        // Update existing course
        await fetch(`/api/vip/courses/${courseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ title: title.trim(), slug: slug.trim(), focus: focus.trim() }),
        });
      } else {
        // Create new course
        const slugVal = slug.trim() || title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const res = await fetch('/api/vip/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ title: title.trim(), slug: slugVal, focus: focus.trim() }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Failed to create course');
        setCourseId(data.course.id);
      }

      onCourseCreated();
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
      setPhase('edit');
    }
  };

  if (phase === 'loading') {
    return (
      <Overlay onClose={onClose}>
        <div className="flex items-center justify-center h-full text-neutral-400">Loading...</div>
      </Overlay>
    );
  }

  return (
    <Overlay onClose={onClose}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                placeholder="Course title"
                className="text-lg font-bold bg-transparent border-none outline-none w-full placeholder-neutral-400"
              />
              <span className="text-xs text-neutral-400 shrink-0">{weeks.length} week(s)</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {error && <span className="text-sm text-red-500">{error}</span>}
              <button
                type="button"
                onClick={saveCourse}
                disabled={phase === 'saving' || !title.trim()}
                className="px-4 py-1.5 text-sm rounded-lg bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40"
              >
                {phase === 'saving' ? 'Saving...' : courseId ? 'Save' : 'Create course'}
              </button>
            </div>
          </div>

          {/* 3-column body */}
          <div className="flex flex-1 overflow-hidden">
            {/* Left: Palette */}
            <aside className="w-48 shrink-0 p-4 border-r border-neutral-200 dark:border-neutral-700 overflow-y-auto">
              <ComponentPalette />
            </aside>

            {/* Center: Canvas */}
            <main className="flex-1 p-4 overflow-y-auto">
              <WeekCanvas
                weeks={weeks}
                selectedWeek={selectedWeekId}
                onSelectWeek={setSelectedWeekId}
                onSelectComponent={setSelectedComponentId}
                selectedComponentId={selectedComponentId}
                onAddWeek={addWeek}
                onUpdateWeek={updateWeek}
              />
            </main>

            {/* Right: Inspector */}
            <aside className="w-72 shrink-0 p-4 border-l border-neutral-200 dark:border-neutral-700 overflow-y-auto">
              <ComponentInspector
                component={selectedComponent}
                onUpdate={updateComponent}
                onDelete={deleteComponent}
              />
            </aside>
          </div>
        </div>

        <DragOverlay>
          {activeDragItem && (
            <div className="p-2 rounded-lg bg-blue-500 text-white text-sm shadow-lg">
              + {activeDragItem.type.replace(/_/g, ' ')}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Modal */}
      <div className="relative w-full h-full max-w-[1400px] mx-auto flex flex-col bg-white dark:bg-neutral-900 shadow-2xl">
        {children}
      </div>
    </div>
  );
}
