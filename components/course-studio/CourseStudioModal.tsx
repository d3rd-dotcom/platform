'use client';

import { useState, useEffect, useCallback } from 'react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './CourseStudioModal.module.css';
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

const PALETTE_ICONS: Record<ComponentType, string> = {
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

interface CourseStudioProps {
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
}: CourseStudioProps) {
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
  const [drawerOpen, setDrawerOpen] = useState(true);

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

    if (activeData?.source === 'palette' && overData?.weekId) {
      addComponentToWeek(overData.weekId, activeData.type as ComponentType);
      return;
    }

    if (activeData?.source === 'palette' && overData?.type) {
      const targetWeek = weeks.find((w) => w.components.some((c) => c.id === over.id));
      if (targetWeek) {
        addComponentToWeek(targetWeek.id, activeData.type as ComponentType);
      }
      return;
    }

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
        await fetch(`/api/vip/courses/${courseId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ title: title.trim(), slug: slug.trim(), focus: focus.trim() }),
        });
      } else {
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
      <div className={styles.layout}>
        <SideNavigation />
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.body}>
          {/* Header */}
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <button
                type="button"
                onClick={onClose}
                className={styles.backBtn}
                title="Back to courses"
              >
                ←
              </button>
              <div className={styles.headerMeta}>
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                  placeholder="Course title"
                  className={styles.titleInput}
                />
                <span className={styles.weekCount}>{weeks.length} week(s)</span>
              </div>
            </div>
            <div className={styles.headerActions}>
              {error && <span className={styles.errorText}>{error}</span>}
              <span className={styles.dirtyDot} data-visible={dirty ? '' : undefined} />
              <button
                type="button"
                onClick={saveCourse}
                disabled={phase === 'saving' || !title.trim()}
                className={styles.saveBtn}
              >
                {phase === 'saving' ? 'Saving...' : courseId ? 'Save' : 'Create'}
              </button>
            </div>
          </div>

          {/* 3-column body */}
          <div className={styles.columns}>
            {/* Left: collapsible palette drawer */}
            <aside className={styles.paletteColumn}>
              <div className={`${styles.paletteDrawer} ${drawerOpen ? '' : styles.paletteClosed}`}>
                <ComponentPalette />
              </div>
              <button
                type="button"
                className={styles.drawerToggle}
                onClick={() => setDrawerOpen((o) => !o)}
                title={drawerOpen ? 'Close item shop' : 'Open item shop'}
              >
                {drawerOpen ? '◀' : '▶'}
              </button>
            </aside>

            {/* Center: Canvas with WYSIWYG */}
            <main className={styles.canvas}>
              <WeekCanvas
                weeks={weeks}
                selectedWeek={selectedWeekId}
                onSelectWeek={setSelectedWeekId}
                onSelectComponent={setSelectedComponentId}
                selectedComponentId={selectedComponentId}
                onAddWeek={addWeek}
                onUpdateWeek={updateWeek}
                onDeleteComponent={deleteComponent}
              />
            </main>

            {/* Right: Inspector as overlay card */}
            {selectedComponent && (
              <div className={styles.inspectorOverlay}>
                <div className={styles.inspectorBackdrop} onClick={() => setSelectedComponentId(null)} />
                <aside className={styles.inspectorCard}>
                  <ComponentInspector
                    component={selectedComponent}
                    onUpdate={updateComponent}
                    onDelete={deleteComponent}
                  />
                </aside>
              </div>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeDragItem && (
            <div className={styles.dragOverlay}>
              <span className={styles.dragOverlayIcon}>
                {PALETTE_ICONS[activeDragItem.type] ?? '❓'}
              </span>
              <span className={styles.dragOverlayLabel}>
                + {activeDragItem.type.replace(/_/g, ' ')}
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
