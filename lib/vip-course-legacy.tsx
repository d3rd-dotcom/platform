import { useCallback, useEffect, useState } from 'react';
import type { CourseComponentRecord } from './vip-course-db';

// ── Old JournalSection type (shared between WeekTasksView and AccordionJournalCard) ──

export type LegacyType =
  | 'text' | 'list' | 'blurts' | 'lives' | 'checklist' | 'time-map'
  | 'enjoy-list' | 'life-pie' | 'numbered-list' | 'affirmations';

export interface JournalSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  type: LegacyType;
  instructions: string;
  placeholder?: string;
  listCount?: number;
  listLabels?: string[];
  checkItems?: string[];
  startNumber?: number;
}

// ── Default icon (used when mapping from DB records that have no icon stored) ──

const DefaultIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

// ── Map DB component → old JournalSection ──

function extractInstructions(comp: CourseComponentRecord): string {
  const c = comp.config as Record<string, unknown>;
  return (c.content as string) || (c.question as string) || (c.prompt as string) || (c.placeholder as string) || comp.title;
}

function extractLegacyType(comp: CourseComponentRecord): LegacyType {
  const c = comp.config as Record<string, unknown>;
  return (c.legacyType as LegacyType) || 'text';
}

export function mapComponentToSection(comp: CourseComponentRecord): JournalSection {
  const cfg = comp.config as Record<string, unknown>;
  const legacyType = extractLegacyType(comp);
  const labels = cfg.labels as string[] | undefined;
  const count = cfg.count as number | undefined;
  const options = cfg.options as Array<{ id: string; text: string }> | undefined;

  let startNumber: number | undefined;
  if (legacyType === 'lives') {
    const firstLabel = labels?.[0] || '';
    const match = firstLabel.match(/(\d+)/);
    startNumber = match ? parseInt(match[1], 10) : 1;
  }

  return {
    id: comp.id,
    title: comp.title,
    icon: DefaultIcon,
    type: legacyType,
    instructions: extractInstructions(comp),
    placeholder: (cfg.placeholder as string) || undefined,
    listCount: labels?.length || count || undefined,
    listLabels: labels,
    checkItems: options?.map((o) => o.text) || undefined,
    startNumber,
  };
}

// ── Hook: fetch the full course by slug and map a specific week's components ──

const FETCH_TIMEOUT = 10_000;
const courseCache = new Map<string, JournalSection[]>();

export function useCourseSections(slug: string, weekNumber: number) {
  const [sections, setSections] = useState<JournalSection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCourse = useCallback(async () => {
    const cacheKey = `${slug}:${weekNumber}`;
    const cached = courseCache.get(cacheKey);
    if (cached) {
      setSections(cached);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    try {
      const res = await fetch(`/api/vip/courses/slug/${slug}`, {
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(timer);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load course');
      }
      const data = await res.json();
      const course = data.course;

      if (!course) {
        setSections([]);
        setLoading(false);
        return;
      }

      const weeksByNumber = new Map<number, JournalSection[]>();
      for (const w of course.weeks) {
        const taskComponents = w.components.filter((comp: CourseComponentRecord) => {
          const c = comp.config as Record<string, unknown>;
          return !(typeof c.url === 'string' && typeof c.imageUrl === 'string' && typeof c.originalName === 'string');
        });
        const mapped = taskComponents.map(mapComponentToSection);
        weeksByNumber.set(w.weekNumber, mapped);
      }

      // Cache all weeks for this slug
      for (const [wn, sectionsList] of weeksByNumber) {
        courseCache.set(`${slug}:${wn}`, sectionsList);
      }

      setSections(weeksByNumber.get(weekNumber) ?? []);
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        setError('Request timed out');
      } else {
        setError(err.message);
      }
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }, [slug, weekNumber]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchCourse();
  }, [fetchCourse]);

  return { sections, loading, error };
}
