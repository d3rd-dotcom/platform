'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './CourseStudioModal.module.css';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

function collisionFallback(args: Parameters<typeof closestCenter>[0]) {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
}
import ComponentPalette from './ComponentPalette';
import WeekCanvas from './WeekCanvas';
import ComponentInspector from './ComponentInspector';
import CourseBuilderTour from './CourseBuilderTour';
import type { VipCourseFull, CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';

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
  const [phase, setPhase] = useState<'loading' | 'edit' | 'saving'>(existingCourseId ? 'loading' : 'edit');
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
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus the title input for new courses
  useEffect(() => {
    if (phase === 'edit' && !existingCourseId && titleRef.current) {
      titleRef.current.focus();
    }
  }, [phase, existingCourseId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const selectedComponent = selectedComponentId
    ? weeks.flatMap((w) => w.components).find((c) => c.id === selectedComponentId) ?? null
    : null;

  // Load existing course
  useEffect(() => {
    if (!existingCourseId) { return; }
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

    // Palette → canvas drop
    if (active.data.current?.source === 'palette') {
      const compType = active.data.current.type as ComponentType;
      const overData = over.data.current;

      if (overData?.weekId) {
        addComponentToWeek(overData.weekId, compType);
        return;
      }

      if (overData?.type || overData?.source === 'canvas') {
        const targetWeek = weeks.find((w) => w.components.some((c) => c.id === over.id));
        if (targetWeek) {
          addComponentToWeek(targetWeek.id, compType);
          return;
        }
      }

      if (typeof over.id === 'string' && over.id.startsWith('week-')) {
        const weekId = over.id.slice(5);
        if (weeks.some((w) => w.id === weekId)) {
          addComponentToWeek(weekId, compType);
          return;
        }
      }

      const byWeek = weeks.find((w) => w.id === over.id);
      if (byWeek) {
        addComponentToWeek(byWeek.id, compType);
        return;
      }
      const byComponent = weeks.find((w) => w.components.some((c) => c.id === over.id));
      if (byComponent) {
        addComponentToWeek(byComponent.id, compType);
        return;
      }
      return;
    }

    // Sortable reorder (canvas → canvas)
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
        collisionDetection={collisionFallback}
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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>
              <div className={styles.headerMeta}>
                <input
                  ref={titleRef}
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
                  placeholder="Course title"
                  className={styles.titleInput}
                  data-tour="builder-title"
                />
                {slug && (
                  <span className={styles.slugText}>/{slug}</span>
                )}
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
                title={!title.trim() ? 'Enter a course title first' : ''}
              >
                {phase === 'saving' ? 'Saving...' : courseId ? 'Save' : 'Create course'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className={styles.columns}>
            {/* Left: palette drawer */}
            <aside className={styles.paletteColumn} data-tour="builder-palette">
              <div className={`${styles.paletteDrawer} ${drawerOpen ? '' : styles.paletteClosed}`}>
                <ComponentPalette />
              </div>
              <button
                type="button"
                className={styles.drawerToggle}
                onClick={() => setDrawerOpen((o) => !o)}
                title={drawerOpen ? 'Close components' : 'Open components'}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  {drawerOpen ? <path d="M19 15l-7-7-7 7"/> : <path d="M5 9l7 7 7-7"/>}
                </svg>
              </button>
            </aside>

            {/* Center: Canvas */}
            <main className={styles.canvas} data-tour="builder-canvas">
              <WeekCanvas
                weeks={weeks}
                selectedWeek={selectedWeekId}
                onSelectWeek={setSelectedWeekId}
                onSelectComponent={setSelectedComponentId}
                selectedComponentId={selectedComponentId}
                onAddWeek={addWeek}
                onUpdateWeek={updateWeek}
                onDeleteComponent={deleteComponent}
                onUpdateComponent={updateComponent}
              />
            </main>

            {/* Right: Inspector panel */}
            <AnimatePresence>
              {selectedComponent && (
                <motion.aside
                  key={selectedComponentId}
                  className={styles.inspectorPanel}
                  initial={{ x: 320, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 320, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                  data-tour="builder-inspector"
                >
                  <ComponentInspector
                    component={selectedComponent}
                    onUpdate={updateComponent}
                    onDelete={deleteComponent}
                    onClose={() => setSelectedComponentId(null)}
                  />
                </motion.aside>
              )}
            </AnimatePresence>
          </div>
        </div>

        <DragOverlay>
          <AnimatePresence>
            {activeDragItem && (
              <motion.div
                className={styles.dragOverlay}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
              >
                <span className={styles.dragOverlayLabel}>
                  + {activeDragItem.type.replace(/_/g, ' ')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </DragOverlay>
      </DndContext>

      <CourseBuilderTour />
    </div>
  );
}
