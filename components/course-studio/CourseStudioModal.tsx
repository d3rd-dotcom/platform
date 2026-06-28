'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { ArrowCounterClockwise, Eye, CheckCircle } from '@phosphor-icons/react';
import CourseModule from '@/components/course-renderers/CourseModule';
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
import ComponentPanel from './ComponentPanel';
import CourseBuilderTour from './CourseBuilderTour';
import type { VipCourseFull, CourseComponentRecord, ComponentType, VipCourseStatus } from '@/lib/vip-course-db';

interface CourseStudioProps {
  authHeaders: () => Promise<HeadersInit>;
  onClose: () => void;
  onCourseCreated: () => void;
  existingCourseId?: string;
  initialCourse?: {
    title: string;
    focus: string;
    weeks: Array<{
      weekNumber: number;
      title: string;
      theme: string;
      components: Array<{
        componentType: string;
        title: string;
        config: Record<string, unknown>;
        required?: boolean;
      }>;
    }>;
  };
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
  initialCourse,
}: CourseStudioProps) {
  const [phase, setPhase] = useState<'loading' | 'edit' | 'saving'>(existingCourseId ? 'loading' : 'edit');
  const [courseId, setCourseId] = useState<string | null>(existingCourseId ?? null);
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [slug, setSlug] = useState('');
  const [weeks, setWeeks] = useState<CourseDraft['weeks']>(() => {
    if (initialCourse?.weeks?.length) {
      const now = Date.now();
      return initialCourse.weeks.map((w, i) => ({
        id: `gen-${now}-${i}`,
        weekNumber: w.weekNumber,
        title: w.title,
        theme: w.theme,
        components: (w.components ?? []).map((c, ci) => ({
          id: `genc-${now}-${i}-${ci}`,
          weekId: `gen-${now}-${i}`,
          sortOrder: ci,
          componentType: c.componentType as ComponentType,
          title: c.title,
          config: c.config,
          required: c.required ?? false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })),
      }));
    }
    return [createBlankWeek(1)];
  });
  const [selectedWeekId, setSelectedWeekId] = useState(weeks[0]?.id ?? '');
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [activeDragItem, setActiveDragItem] = useState<{ type: ComponentType } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!existingCourseId);
  const [deletedComponent, setDeletedComponent] = useState<{
    component: CourseComponentRecord;
    weekId: string;
    sortOrder: number;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [status, setStatus] = useState<VipCourseStatus>('draft');
  const [publishing, setPublishing] = useState(false);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const deriveSlug = (val: string) =>
    val.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

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
        setStatus(course.status);
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

  // Pre-populate from AI-generated course
  useEffect(() => {
    if (!initialCourse) return;
    setTitle(initialCourse.title);
    setFocus(initialCourse.focus);
    setSlug(deriveSlug(initialCourse.title));
    if (initialCourse.weeks?.length) {
      setSelectedWeekId(weeks[0]?.id ?? '');
    }
    setPhase('edit');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount

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
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    let stored: { component: CourseComponentRecord; weekId: string; sortOrder: number } | null = null;
    setWeeks((prev) => {
      const next = prev.map((w) => {
        const idx = w.components.findIndex((c) => c.id === compId);
        if (idx !== -1) {
          stored = { component: w.components[idx], weekId: w.id, sortOrder: idx };
          return { ...w, components: w.components.filter((c) => c.id !== compId) };
        }
        return w;
      });
      return next;
    });
    setSelectedComponentId(null);
    setDirty(true);
    if (stored) {
      setDeletedComponent(stored);
      undoTimeoutRef.current = setTimeout(() => setDeletedComponent(null), 5000);
    }
  };

  const undoDelete = () => {
    if (!deletedComponent) return;
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    const { component, weekId, sortOrder } = deletedComponent;
    const newId = tempId();
    setWeeks((prev) =>
      prev.map((w) => {
        if (w.id !== weekId) return w;
        const comps = [...w.components];
        comps.splice(sortOrder, 0, { ...component, id: newId });
        return { ...w, components: comps.map((c, i) => ({ ...c, sortOrder: i })) };
      }),
    );
    setSelectedComponentId(newId);
    setDirty(true);
    setDeletedComponent(null);
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
      await saveCourseData();
      onCourseCreated();
    } catch (err: any) {
      setError(err.message ?? 'Save failed');
      setPhase('edit');
    }
  };

  const saveCourseData = async () => {
    const headers = await authHeaders();
    let currentCourseId = courseId;

    // Step 1: Save course metadata
    if (currentCourseId) {
      const res = await fetch(`/api/vip/courses/${currentCourseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: title.trim(), slug: slug.trim(), focus: focus.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save course');
      }
    } else {
      const slugVal = slug.trim() || deriveSlug(title.trim());
      const res = await fetch('/api/vip/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: title.trim(), slug: slugVal, focus: focus.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create course');
      setCourseId(data.course.id);
      currentCourseId = data.course.id;
    }

    // Step 2: Save weeks and components via bulk content endpoint
    if (currentCourseId) {
      const contentRes = await fetch(`/api/vip/courses/${currentCourseId}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          weeks: weeks.map((w, i) => ({
            weekNumber: w.weekNumber,
            title: w.title,
            theme: w.theme,
            sortOrder: i,
            components: w.components.map((c, ci) => ({
              componentType: c.componentType,
              title: c.title,
              config: c.config,
              sortOrder: ci,
              required: c.required,
            })),
          })),
        }),
      });
      if (!contentRes.ok) {
        const data = await contentRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save course content');
      }
      const { course: savedCourse } = await contentRes.json();

      // Update local state with real DB IDs from the saved course
      setWeeks(
        savedCourse.weeks.map((w: any) => ({
          id: w.id,
          weekNumber: w.weekNumber,
          title: w.title,
          theme: w.theme,
          components: w.components.map((c: any) => ({
            id: c.id,
            weekId: c.weekId,
            sortOrder: c.sortOrder,
            componentType: c.componentType,
            title: c.title,
            config: c.config,
            required: c.required,
            createdAt: c.createdAt,
            updatedAt: c.updatedAt,
          })),
        })),
      );
      setSelectedWeekId(savedCourse.weeks[0]?.id ?? weeks[0]?.id ?? '');
    }

    setDirty(false);
    setPhase('edit');
  };

  const publishCourse = async () => {
    if (!courseId) {
      // Save first, then publish
      setPhase('saving');
      try {
        await saveCourseData();
      } catch (err: any) {
        setError(err.message ?? 'Save failed');
        setPhase('edit');
        return;
      }
    }
    setPublishing(true);
    setError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/vip/courses/${courseId}/publish`, {
        method: 'POST',
        headers,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Publish failed');
      }
      setStatus('published');
    } catch (err: any) {
      setError(err.message ?? 'Publish failed');
    } finally {
      setPublishing(false);
    }
  };

  const handleBack = async () => {
    if (previewMode) {
      setPreviewMode(false);
      return;
    }
    if (dirty && title.trim()) {
      setPhase('saving');
      try {
        await saveCourseData();
      } catch (err: any) {
        setError(err.message ?? 'Save failed');
        setPhase('edit');
        return;
      }
    }
    onClose();
  };

  if (phase === 'loading') {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const previewCourse: VipCourseFull = {
    id: courseId ?? 'preview',
    userId: '',
    slug,
    title,
    focus,
    coverImageUrl: null,
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorName: 'Espeon',
    authorAvatar: null,
    weeks: weeks.map((w) => ({
      id: w.id,
      courseId: courseId ?? 'preview',
      weekNumber: w.weekNumber,
      title: w.title,
      theme: w.theme,
      status: 'draft' as const,
      sortOrder: Math.max(0, w.weekNumber - 1),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      components: w.components,
    })),
  };

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
                onClick={handleBack}
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
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!slugManuallyEdited) {
                      setSlug(deriveSlug(e.target.value));
                    }
                    setDirty(true);
                  }}
                  placeholder="Course title"
                  className={styles.titleInput}
                  data-tour="builder-title"
                />
                <span className={styles.slugPrefix}>/</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugManuallyEdited(true);
                    setDirty(true);
                  }}
                  placeholder="url-slug"
                  className={styles.slugInput}
                />
              </div>
            </div>
            <div className={styles.headerActions}>
              {error && <span className={styles.errorText}>{error}</span>}
              <span className={styles.dirtyDot} data-visible={dirty ? '' : undefined} />
              <button
                type="button"
                onClick={async () => {
                  if (dirty && title.trim()) {
                    setPhase('saving');
                    try {
                      await saveCourseData();
                    } catch (err: any) {
                      setError(err.message ?? 'Save failed');
                      setPhase('edit');
                      return;
                    }
                  }
                  setPreviewMode(true);
                }}
                className={styles.previewBtn}
                title={previewMode ? 'Back to editing' : 'Preview course'}
              >
                <Eye size={14} weight="bold" />
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              {courseId && (
                <div className={styles.statusGroup}>
                  <span className={`${styles.statusBadge} ${status === 'published' ? styles.statusPublished : ''}`}>
                    {status === 'published' ? 'Published' : 'Draft'}
                  </span>
                  {status !== 'published' && (
                    <button
                      type="button"
                      onClick={publishCourse}
                      disabled={publishing}
                      className={styles.publishBtn}
                    >
                      {publishing ? 'Publishing...' : 'Publish'}
                    </button>
                  )}
                </div>
              )}
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
          {previewMode ? (
            <div className={styles.previewBody}>
              <CourseModule course={previewCourse} authHeaders={authHeaders} />
            </div>
          ) : (
            <div className={styles.columns}>
              {/* Left: Component panel */}
              <motion.aside
                className={styles.componentPanel}
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                data-tour="builder-panel"
              >
                <ComponentPanel
                  component={selectedComponent}
                  onUpdate={updateComponent}
                  onDelete={deleteComponent}
                  onClose={() => setSelectedComponentId(null)}
                />
              </motion.aside>

              {/* Center: Canvas */}
              <main
                className={styles.canvas}
                data-tour="builder-canvas"
              >
                <WeekCanvas
                  weeks={weeks}
                  selectedWeek={selectedWeekId}
                  onSelectWeek={(weekId) => { setSelectedWeekId(weekId); setSelectedComponentId(null); }}
                  onSelectComponent={setSelectedComponentId}
                  selectedComponentId={selectedComponentId}
                  onAddWeek={addWeek}
                  onUpdateWeek={updateWeek}
                  onDeleteComponent={deleteComponent}
                  onUpdateComponent={updateComponent}
                  onAddComponent={addComponentToWeek}
                />
              </main>

              {/* Right: palette drawer */}
              <aside className={styles.paletteColumn} data-tour="builder-palette">
                <button
                  type="button"
                  className={styles.drawerToggle}
                  onClick={() => setDrawerOpen((o) => !o)}
                  title={drawerOpen ? 'Close components' : 'Open components'}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    {drawerOpen ? <path d="M9 6l6 6-6 6"/> : <path d="M15 18l-6-6 6-6"/>}
                  </svg>
                </button>
                <div className={`${styles.paletteDrawer} ${drawerOpen ? '' : styles.paletteClosed}`}>
                  <ComponentPalette onAddComponent={(type) => addComponentToWeek(selectedWeekId, type)} />
                </div>
              </aside>
            </div>
          )}
        </div>

        {deletedComponent && (
          <div className={styles.toast}>
            <span>Component removed</span>
            <button type="button" className={styles.undoBtn} onClick={undoDelete}>
              <ArrowCounterClockwise size={14} weight="bold" />
              Undo
            </button>
          </div>
        )}

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
