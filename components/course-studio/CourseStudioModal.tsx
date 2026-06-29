'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { ArrowCounterClockwise, Eye } from '@phosphor-icons/react';
import CoursePreview from './CoursePreview';
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


function collisionFallback(args: Parameters<typeof closestCenter>[0]) {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  return closestCenter(args);
}
import { useSound } from '@/hooks/useSound';
import ComponentPalette from './ComponentPalette';
import ComponentPanel from './ComponentPanel';
import MissionEditor from './MissionEditor';
import VideoEmbedEditor from './VideoEmbedEditor';
import dynamic from 'next/dynamic';

const ReadingEditor = dynamic(() => import('./ReadingEditor'), { ssr: false });
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
  const { play } = useSound();
  const [phase, setPhase] = useState<'loading' | 'edit' | 'saving'>(existingCourseId ? 'loading' : 'edit');
  const [courseId, setCourseId] = useState<string | null>(existingCourseId ?? null);
  const [title, setTitle] = useState('');
  const [focus, setFocus] = useState('');
  const [slug, setSlug] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
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
  const [activeDragItem, setActiveDragItem] = useState<{ type: ComponentType; label?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [readingContent, setReadingContent] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<'reading' | null>(null);
  const [deletedComponent, setDeletedComponent] = useState<{
    component: CourseComponentRecord;
    weekId: string;
    sortOrder: number;
  } | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [status, setStatus] = useState<VipCourseStatus>('draft');
  const [publishing, setPublishing] = useState(false);
  const [showPublishReview, setShowPublishReview] = useState(false);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewDesc, setReviewDesc] = useState('');
  const [reviewSlug, setReviewSlug] = useState('');
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
        setCoverImageUrl(course.coverImageUrl);
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

  const addBlankMission = () => {
    addComponentToWeek(selectedWeekId, 'reflection_journal', { prompt: '', minWords: 0 });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current;
    if (data?.source === 'palette') {
      setActiveDragItem({ type: data.type as ComponentType, label: (data as any).paletteLabel as string | undefined });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;

    // Palette → missions zone drop
    if (activeData?.source === 'palette') {
      const compType = activeData.type as ComponentType;
      const config = activeData.config as Record<string, unknown> | undefined;

      if (over.id === 'missions-drop-zone' || overData?.source === 'missions-zone') {
        addComponentToWeek(selectedWeekId, compType, config);
        return;
      }

      if (overData?.weekId) {
        addComponentToWeek(overData.weekId, compType, config);
        return;
      }

      if (overData?.type || overData?.source === 'canvas') {
        const targetWeek = weeks.find((w) => w.components.some((c) => c.id === over.id));
        if (targetWeek) {
          addComponentToWeek(targetWeek.id, compType, config);
          return;
        }
      }

      if (typeof over.id === 'string' && over.id.startsWith('week-')) {
        const weekId = over.id.slice(5);
        if (weeks.some((w) => w.id === weekId)) {
          addComponentToWeek(weekId, compType, config);
          return;
        }
      }

      const byWeek = weeks.find((w) => w.id === over.id);
      if (byWeek) {
        addComponentToWeek(byWeek.id, compType, config);
        return;
      }
      const byComponent = weeks.find((w) => w.components.some((c) => c.id === over.id));
      if (byComponent) {
        addComponentToWeek(byComponent.id, compType, config);
        return;
      }
      return;
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
        body: JSON.stringify({ title: title.trim(), slug: slug.trim(), focus: focus.trim(), coverImageUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save course');
      }
    } else {
      const slugVal = slug.trim() || deriveSlug(title.trim()) || `course-${Date.now()}`;
      const titleVal = title.trim() || 'Untitled Course';
      const res = await fetch('/api/vip/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ title: titleVal, slug: slugVal, focus: focus.trim(), coverImageUrl }),
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

  const handleOpenPublishReview = async () => {
    if (dirty) {
      setPhase('saving');
      try {
        await saveCourseData();
      } catch (err: any) {
        setError(err.message ?? 'Save failed');
        setPhase('edit');
        return;
      }
    }
    setReviewTitle(title);
    setReviewDesc(focus);
    setReviewSlug(slug || deriveSlug(title));
    setShowPublishReview(true);
  };

  const confirmPublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const headers = await authHeaders();
      if (!courseId) {
        throw new Error('Save the course first');
      }
      const metaRes = await fetch(`/api/vip/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({
          title: reviewTitle.trim(),
          slug: reviewSlug.trim(),
          focus: reviewDesc.trim(),
        }),
      });
      if (!metaRes.ok) {
        const data = await metaRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to save metadata');
      }
      const pubRes = await fetch(`/api/vip/courses/${courseId}/publish`, {
        method: 'POST',
        headers,
      });
      if (!pubRes.ok) {
        const data = await pubRes.json().catch(() => ({}));
        throw new Error(data.error ?? 'Publish failed');
      }
      setTitle(reviewTitle.trim());
      setFocus(reviewDesc.trim());
      setSlug(reviewSlug.trim());
      setStatus('published');
      setShowPublishReview(false);
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
    if (dirty) {
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

  const currentWeek = weeks.find((w) => w.id === selectedWeekId);
  const currentWeekComponents = currentWeek?.components ?? [];
  const selectedComponent = currentWeekComponents.find((c) => c.id === selectedComponentId) ?? null;

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
                    setDirty(true);
                  }}
                  onKeyDown={() => play('click')}
                  placeholder="Course title"
                  className={styles.titleInput}
                  data-tour="builder-title"
                />
              </div>
            </div>
            <div className={styles.headerActions}>
              {error && <span className={styles.errorText}>{error}</span>}
              <span className={styles.dirtyDot} data-visible={dirty ? '' : undefined} />
              <button
                type="button"
                onClick={() => setPreviewMode((p) => !p)}
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
                      onClick={handleOpenPublishReview}
                      disabled={publishing}
                      className={styles.publishBtn}
                    >
                      Review & Publish
                    </button>
                  )}
                </div>
              )}
              <button
                type="button"
                onClick={saveCourse}
                disabled={phase === 'saving'}
                className={styles.saveBtn}
              >
                {phase === 'saving' ? 'Saving...' : courseId ? 'Save' : 'Create course'}
              </button>
            </div>
          </div>

          {/* Body */}
          {previewMode ? (
            <CoursePreview
              weeks={weeks}
              readingContent={readingContent}
            />
          ) : (
            <div className={styles.editorArea}>
              {/* Left: Component panel */}
              <motion.aside
                className={styles.componentPanel}
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                data-tour="builder-panel"
              >
                <div className={styles.panelCard}>
                  <ComponentPanel
                    readingContent={readingContent}
                    missions={currentWeekComponents}
                    selectedMissionId={selectedComponentId}
                    onSelectMission={(id) => { setSelectedComponentId(id); setSelectedSlot(null); }}
                    onDeleteMission={deleteComponent}
                    onAddBlankMission={addBlankMission}
                    onEditReading={() => { setSelectedSlot('reading'); setSelectedComponentId(null); }}
                  />
                </div>
              </motion.aside>

              {/* Right: Component editor */}
              {selectedComponent && (
                <main className={styles.missionEditor}>
                  {selectedComponent.componentType === 'video_embed' ? (
                    <VideoEmbedEditor
                      component={selectedComponent}
                      onUpdate={updateComponent}
                      onDelete={deleteComponent}
                    />
                  ) : (
                    <MissionEditor
                      component={selectedComponent}
                      onUpdate={updateComponent}
                      onDelete={deleteComponent}
                    />
                  )}
                </main>
              )}
              {selectedSlot === 'reading' && (
                <main className={styles.missionEditor}>
                  <ReadingEditor
                    content={readingContent}
                    onSave={(content) => setReadingContent(content)}
                    onClose={() => setSelectedSlot(null)}
                  />
                </main>
              )}

              {/* Bottom: Component palette */}
              <aside className={`${styles.bottomPalette} ${drawerOpen ? '' : styles.bottomPaletteClosed}`} data-tour="builder-palette">
                <button
                  type="button"
                  className={styles.paletteToggle}
                  onClick={() => setDrawerOpen((o) => !o)}
                  title={drawerOpen ? 'Close component palette' : 'Open component palette'}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ transform: drawerOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s ease' }}>
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                  Components
                </button>
                <div className={styles.paletteBody}>
                  <ComponentPalette onAddComponent={(type, config) => addComponentToWeek(selectedWeekId, type, config)} />
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
                  + {activeDragItem.label ?? activeDragItem.type.replace(/_/g, ' ')}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </DragOverlay>

        {showPublishReview && (
          <div className={styles.publishOverlay} onClick={() => setShowPublishReview(false)}>
            <div className={styles.publishDialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.publishCardPreview}>
                <div className={styles.previewCard}>
                  <div className={styles.previewCardThumb}>
                    <div className={styles.previewCardBadge}>
                      <span className={styles.previewBadgeValue}>{weeks.length} session{weeks.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  <div className={styles.previewCardBody}>
                    <h3 className={styles.previewCardTitle}>{reviewTitle || 'Course Title'}</h3>
                    <p className={styles.previewCardDesc}>{reviewDesc || 'No description yet'}</p>
                  </div>
                </div>
              </div>
              <div className={styles.publishForm}>
                <h2 className={styles.publishFormTitle}>Pre-publish Review</h2>
                <p className={styles.publishFormSub}>Set the title, description, and URL slug before publishing.</p>
                <label className={styles.publishField}>
                  <span className={styles.publishFieldLabel}>Title</span>
                  <input
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="Course title"
                    className={styles.publishFieldInput}
                  />
                </label>
                <label className={styles.publishField}>
                  <span className={styles.publishFieldLabel}>Description</span>
                  <textarea
                    value={reviewDesc}
                    onChange={(e) => setReviewDesc(e.target.value)}
                    placeholder="Short description for the course card"
                    rows={3}
                    className={styles.publishFieldTextarea}
                  />
                </label>
                <label className={styles.publishField}>
                  <span className={styles.publishFieldLabel}>URL Slug</span>
                  <div className={styles.publishSlugRow}>
                    <span className={styles.publishSlugPrefix}>/</span>
                    <input
                      value={reviewSlug}
                      onChange={(e) => setReviewSlug(e.target.value)}
                      placeholder="url-slug"
                      className={styles.publishFieldInput}
                    />
                  </div>
                </label>
                <div className={styles.publishActions}>
                  <button
                    type="button"
                    onClick={() => setShowPublishReview(false)}
                    className={styles.publishCancelBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmPublish}
                    disabled={publishing || !reviewTitle.trim() || !reviewSlug.trim()}
                    className={styles.publishConfirmBtn}
                  >
                    {publishing ? 'Publishing...' : 'Confirm & Publish'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DndContext>

      <CourseBuilderTour />
    </div>
  );
}
