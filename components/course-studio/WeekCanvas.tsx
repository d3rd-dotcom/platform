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
import { useSound } from '@/hooks/useSound';
import type { CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';
import styles from './WeekCanvas.module.css';

const COMPONENT_ACCENTS: Record<ComponentType, string> = {
  rich_text: '#5168FF',
  multiple_choice: '#8B5CF6',
  media_embed: '#38BDF8',
  image_embed: '#38BDF8',
  video_embed: '#22D3EE',
  file_upload: '#2DD4BF',
  text_input: '#34D399',
  rating_scale: '#F59E0B',
  reflection_journal: '#F472B6',
  quiz_block: '#EF4444',
  nft_gate: '#A855F7',
  mission_container: '#6B7280',
};

const COMPONENT_ARTWORKS: Record<ComponentType, string> = {
  rich_text:
    'linear-gradient(135deg, #5168FF 0%, #7C8FFF 40%, #A78BFA 100%), radial-gradient(120% 140% at 20% 30%, rgba(255,255,255,0.35) 0%, transparent 70%)',
  multiple_choice:
    'linear-gradient(135deg, #7C3AED 0%, #A78BFA 40%, #C4B5FD 100%), radial-gradient(120% 120% at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 65%)',
  media_embed:
    'linear-gradient(135deg, #0284C7 0%, #38BDF8 45%, #7DD3FC 100%), radial-gradient(130% 110% at 60% 40%, rgba(255,255,255,0.4) 0%, transparent 60%)',
  image_embed:
    'linear-gradient(135deg, #0284C7 0%, #38BDF8 45%, #7DD3FC 100%), radial-gradient(130% 110% at 60% 40%, rgba(255,255,255,0.4) 0%, transparent 60%)',
  video_embed:
    'linear-gradient(135deg, #0891B2 0%, #22D3EE 50%, #67E8F9 100%), radial-gradient(120% 140% at 40% 30%, rgba(255,255,255,0.35) 0%, transparent 65%)',
  file_upload:
    'linear-gradient(135deg, #0D9488 0%, #2DD4BF 45%, #5EEAD4 100%), radial-gradient(130% 120% at 70% 60%, rgba(255,255,255,0.3) 0%, transparent 55%)',
  text_input:
    'linear-gradient(135deg, #059669 0%, #34D399 50%, #6EE7B7 100%), radial-gradient(110% 130% at 20% 80%, rgba(255,255,255,0.4) 0%, transparent 60%)',
  rating_scale:
    'linear-gradient(135deg, #D97706 0%, #F59E0B 45%, #FCD34D 100%), radial-gradient(120% 120% at 50% 20%, rgba(255,255,255,0.4) 0%, transparent 60%)',
  reflection_journal:
    'linear-gradient(135deg, #DB2777 0%, #F472B6 50%, #F9A8D4 100%), radial-gradient(130% 140% at 30% 40%, rgba(255,255,255,0.35) 0%, transparent 65%)',
  quiz_block:
    'linear-gradient(135deg, #DC2626 0%, #F87171 45%, #FCA5A5 100%), radial-gradient(120% 130% at 70% 30%, rgba(255,255,255,0.4) 0%, transparent 60%)',
  nft_gate:
    'linear-gradient(135deg, #7C3AED 0%, #A855F7 45%, #C084FC 100%), radial-gradient(120% 130% at 50% 50%, rgba(255,255,255,0.35) 0%, transparent 60%)',
  mission_container:
    'linear-gradient(135deg, #6B7280 0%, #9CA3AF 40%, #D1D5DB 100%), radial-gradient(120% 140% at 30% 40%, rgba(255,255,255,0.35) 0%, transparent 70%)',
};

const COMPONENT_LABELS: Record<ComponentType, string> = {
  rich_text: 'Rich Text',
  multiple_choice: 'Multiple Choice',
  media_embed: 'Media',
  image_embed: 'Image',
  video_embed: 'Video',
  file_upload: 'File Upload',
  text_input: 'Text Input',
  rating_scale: 'Rating',
  reflection_journal: 'Field Notes',
  quiz_block: 'Quiz',
  nft_gate: 'NFT Gate',
  mission_container: 'Mission',
};

function getComponentPreview(component: CourseComponentRecord): string | null {
  const config = (component.config ?? {}) as Record<string, unknown>;
  switch (component.componentType) {
    case 'rich_text': {
      const content = config.content as string | undefined;
      return content ? content.slice(0, 90) + (content.length > 90 ? '…' : '') : null;
    }
    case 'multiple_choice': {
      const q = config.question as string | undefined;
      const opts = config.options as Array<{ id: string; text: string; isCorrect: boolean }> | undefined;
      if (!opts || opts.length === 0) return q ?? null;
      const correct = opts.filter((o) => o.isCorrect).length;
      const summary = `${opts.length} option${opts.length === 1 ? '' : 's'}${correct > 0 ? ` · ${correct} correct` : ''}`;
      return q ? `${q} — ${summary}` : summary;
    }
    case 'media_embed':
    case 'image_embed':
      return (config.alt as string) || (config.url as string) || null;
    case 'video_embed':
      return (config.url as string) ?? null;
    case 'text_input':
      return (config.placeholder as string) ?? null;
    case 'rating_scale': {
      const min = config.min ?? 1;
      const max = config.max ?? 5;
      return `${min}–${max} scale`;
    }
    case 'reflection_journal': {
      const prompt = config.prompt as string | undefined;
      return prompt ? prompt.slice(0, 90) + (prompt.length > 90 ? '…' : '') : null;
    }
    case 'quiz_block': {
      const timeLimit = config.timeLimitMinutes as number | undefined;
      return timeLimit ? `${timeLimit} min quiz` : 'Quiz';
    }
    case 'file_upload': {
      const types = config.acceptedTypes as string[] | undefined;
      return types?.length ? types.join(', ') : 'File upload';
    }
    case 'nft_gate': {
      const collection = config.collection as string ?? '';
      if (collection === 'academic_angels') return 'Academic Angels';
      if (collection === 'vip_club') return 'VIP Club';
      return 'Custom NFT';
    }
    default:
      return null;
  }
}

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
  onAddComponent: (weekId: string, type: ComponentType, config?: Record<string, unknown>) => void;
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

  const accent = COMPONENT_ACCENTS[component.componentType];
  const artwork = COMPONENT_ARTWORKS[component.componentType];
  const hasTitle = !!component.title;
  const preview = getComponentPreview(component);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, '--comp-accent': accent } as React.CSSProperties}
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${isDragging ? styles.cardDragging : ''}`}
      onClick={(e) => { e.stopPropagation(); onSelect(component.id); }}
    >
      {/* ── Headpiece with artwork as the "kanji" icon ── */}
      <div className={styles.cardHead}>
        <div className={styles.cardHandle} {...attributes} {...listeners}>
          <DotsSixVertical size={12} weight="bold" />
        </div>

        <span className={styles.cardArtwork} style={{ backgroundImage: artwork }} aria-hidden="true" />

        <div className={styles.cardHeadInfo}>
          {hasTitle ? (
            <span className={styles.cardType}>{component.title}</span>
          ) : (
            <span className={styles.cardTypeLabel}>
              {COMPONENT_LABELS[component.componentType]}
            </span>
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

      {/* ── Body with accent bar and preview ── */}
      <div className={styles.cardBody}>
        <span className={styles.cardAccent} aria-hidden="true" />

        <div className={styles.cardInfo}>
          {hasTitle && (
            <span className={styles.cardTypeLabel}>
              {COMPONENT_LABELS[component.componentType]}
            </span>
          )}
          {preview ? (
            <span className={styles.cardPreview}>{preview}</span>
          ) : !hasTitle ? (
            <span className={styles.cardEmpty}>Tap to add content</span>
          ) : null}
        </div>
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
  onAddComponent,
}: {
  week: StudioWeek;
  components: CourseComponentRecord[];
  selectedComponentId: string | null;
  onSelectComponent: (id: string | null) => void;
  onDeleteComponent: (id: string) => void;
  onAddComponent: (weekId: string, type: ComponentType, config?: Record<string, unknown>) => void;
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
        <button
          type="button"
          className={styles.dropZoneEmpty}
          onClick={() => onAddComponent(week.id, 'rich_text')}
        >
          <span className={styles.dropZoneEmptyIcon}>
            <Plus size={20} weight="bold" />
          </span>
        </button>
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
  onUpdateComponent,
  onAddComponent,
}: WeekCanvasProps) {
  const { play } = useSound();
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
      </div>

      {/* Week meta inputs */}
      <div className={styles.weekMeta}>
        <span className={styles.weekBadge}>Week {displayWeek.weekNumber}</span>
        <input
          value={displayWeek.title}
          onChange={(e) => onUpdateWeek(displayWeek.id, { title: e.target.value })}
          onKeyDown={() => play('click')}
          placeholder="Name this week, e.g. Mindfulness Basics"
          className={styles.weekTitleInput}
        />
      </div>
      <input
        value={displayWeek.theme}
        onChange={(e) => onUpdateWeek(displayWeek.id, { theme: e.target.value })}
        onKeyDown={() => play('click')}
        placeholder="Theme — shows as subtitle in the course view"
        className={styles.weekThemeInput}
      />

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
        onAddComponent={onAddComponent}
      />
    </div>
  );
}
