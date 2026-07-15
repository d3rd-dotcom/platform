'use client';

import { useState, useRef, useEffect } from 'react';
import { Feather, Plus, X, CaretDown, BookOpen, Clock } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './page.module.css';

type SectionType = 'scene' | 'dialogue' | 'note' | 'turning point';

type Section = {
  id: string;
  type: SectionType;
  content: string;
};

type Week = {
  id: number;
  title: string;
  sections: Section[];
};

const SECTION_TYPES: SectionType[] = ['scene', 'dialogue', 'note', 'turning point'];

const SECTION_LABELS: Record<SectionType, string> = {
  scene: 'Scene',
  dialogue: 'Dialogue',
  note: 'Note',
  'turning point': 'Turning Point',
};

const SECTION_DOT_CLASS: Record<SectionType, string> = {
  scene: styles.dotScene,
  dialogue: styles.dotDialogue,
  note: styles.dotNote,
  'turning point': styles.dotTurning,
};

const SECTION_CARD_CLASS: Record<SectionType, string> = {
  scene: styles.sectionCardScene,
  dialogue: styles.sectionCardDialogue,
  note: styles.sectionCardNote,
  'turning point': styles.sectionCardTurning,
};

const SECTION_TYPE_BTN_CLASS: Record<SectionType, string> = {
  scene: styles.sectionTypeBtnScene,
  dialogue: styles.sectionTypeBtnDialogue,
  note: styles.sectionTypeBtnNote,
  'turning point': styles.sectionTypeBtnTurning,
};

function uid() {
  return Math.random().toString(36).slice(2);
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      className={styles.sectionTextarea}
    />
  );
}

function SectionCard({
  section,
  onUpdate,
  onRemove,
}: {
  section: Section;
  onUpdate: (s: Section) => void;
  onRemove: () => void;
}) {
  return (
    <div className={`${styles.sectionCard} ${SECTION_CARD_CLASS[section.type]}`}>
      <div className={styles.sectionTop}>
        <div className={styles.sectionTypeGroup}>
          <span className={`${styles.dot} ${SECTION_DOT_CLASS[section.type]}`} />
          <select
            value={section.type}
            onChange={(e) => onUpdate({ ...section, type: e.target.value as SectionType })}
            className={styles.sectionTypeSelect}
          >
            {SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {SECTION_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button onClick={onRemove} className={styles.sectionRemoveBtn}>
          <X size={13} />
        </button>
      </div>
      <AutoResizeTextarea
        value={section.content}
        onChange={(v) => onUpdate({ ...section, content: v })}
        placeholder={
          section.type === 'scene'
            ? 'Describe the scene...'
            : section.type === 'dialogue'
            ? 'What is said...'
            : section.type === 'note'
            ? 'A note to yourself...'
            : 'The story pivots here...'
        }
      />
    </div>
  );
}

function WeekCard({
  week,
  index,
  onUpdate,
}: {
  week: Week;
  index: number;
  onUpdate: (w: Week) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [addingType, setAddingType] = useState<SectionType | null>(null);

  const addSection = (type: SectionType) => {
    const section: Section = { id: uid(), type, content: '' };
    onUpdate({ ...week, sections: [...week.sections, section] });
    setAddingType(null);
    setOpen(true);
  };

  const updateSection = (id: string, updated: Section) => {
    onUpdate({
      ...week,
      sections: week.sections.map((s) => (s.id === id ? updated : s)),
    });
  };

  const removeSection = (id: string) => {
    onUpdate({ ...week, sections: week.sections.filter((s) => s.id !== id) });
  };

  const typeCounts = SECTION_TYPES.reduce(
    (acc, t) => {
      acc[t] = week.sections.filter((s) => s.type === t).length;
      return acc;
    },
    {} as Record<SectionType, number>,
  );

  const hasContent = week.sections.length > 0;

  return (
    <div
      className={`${styles.weekCard} ${open ? styles.weekCardOpen : styles.weekCardClosed}`}
    >
      <div
        className={styles.weekHeader}
        onClick={() => setOpen((v) => !v)}
      >
        <div
          className={`${styles.weekBadge} ${open ? styles.weekBadgeOpen : styles.weekBadgeClosed}`}
        >
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className={styles.weekTitleWrap}>
          {editingTitle && open ? (
            <input
              autoFocus
              value={week.title}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onUpdate({ ...week, title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
              className={styles.weekTitleInput}
            />
          ) : (
            <span
              className={styles.weekTitle}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setOpen(true);
                setEditingTitle(true);
              }}
            >
              {week.title}
            </span>
          )}

          {!open && hasContent && (
            <div className={styles.weekTypeCounts}>
              {SECTION_TYPES.filter((t) => typeCounts[t] > 0).map((t) => (
                <span key={t} className={styles.typeCount}>
                  <span className={`${styles.dot} ${styles.dotSm} ${SECTION_DOT_CLASS[t]}`} />
                  <span className={styles.typeCountNum}>{typeCounts[t]}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {!open && !hasContent && (
            <span className={styles.weekEmptyHint}>empty</span>
          )}
          <CaretDown
            size={15}
            className={`${styles.weekChevron} ${open ? styles.weekChevronOpen : ''}`}
          />
        </div>
      </div>

      {open && (
        <div className={styles.weekBody}>
          {week.sections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {week.sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  onUpdate={(s) => updateSection(section.id, s)}
                  onRemove={() => removeSection(section.id)}
                />
              ))}
            </div>
          )}

          {addingType === null ? (
            <button
              onClick={() => setAddingType('scene')}
              className={styles.addSectionBtn}
            >
              <Plus size={13} />
              <span>Add section</span>
            </button>
          ) : (
            <>
              <div className={styles.sectionTypePicker}>
                {SECTION_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => addSection(t)}
                    className={`${styles.sectionTypeBtn} ${SECTION_TYPE_BTN_CLASS[t]}`}
                  >
                    <span className={`${styles.dot} ${styles.dotSm} ${SECTION_DOT_CLASS[t]}`} />
                    {SECTION_LABELS[t]}
                  </button>
                ))}
                <button
                  onClick={() => setAddingType(null)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </>
          )}

          <p className={styles.renameHint}>Double-click title to rename</p>
        </div>
      )}
    </div>
  );
}

const DEFAULT_WEEKS: Week[] = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  title: `Week ${i + 1}`,
  sections: [],
}));

export default function StoryboardPage() {
  const [weeks, setWeeks] = useState<Week[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_WEEKS;
    try {
      const raw = getStorageItem('storyboard-weeks');
      return raw ? (JSON.parse(raw) as Week[]) : DEFAULT_WEEKS;
    } catch {
      return DEFAULT_WEEKS;
    }
  });
  const [storyTitle, setStoryTitle] = useState<string>(() => {
    if (typeof window === 'undefined') return 'Untitled Story';
    try {
      const raw = getStorageItem('storyboard-title');
      return raw ? (JSON.parse(raw) as string) : 'Untitled Story';
    } catch {
      return 'Untitled Story';
    }
  });
  const [editingStoryTitle, setEditingStoryTitle] = useState(false);

  useEffect(() => {
    setStorageItem('storyboard-weeks', JSON.stringify(weeks));
  }, [weeks]);

  useEffect(() => {
    setStorageItem('storyboard-title', JSON.stringify(storyTitle));
  }, [storyTitle]);

  const updateWeek = (updated: Week) => {
    setWeeks((ws) => ws.map((w) => (w.id === updated.id ? updated : w)));
  };

  const totalSections = weeks.reduce((a, w) => a + w.sections.length, 0);
  const weeksWithContent = weeks.filter((w) => w.sections.length > 0).length;

  return (
    <div className={styles.page}>
      <SideNavigation />

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.titleGroup}>
            <Feather size={18} className={styles.featherIcon} />
            {editingStoryTitle ? (
              <input
                autoFocus
                value={storyTitle}
                onChange={(e) => setStoryTitle(e.target.value)}
                onBlur={() => setEditingStoryTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingStoryTitle(false)}
                className={styles.storyTitleInput}
              />
            ) : (
              <h1
                className={styles.storyTitle}
                onClick={() => setEditingStoryTitle(true)}
                title="Click to rename"
              >
                {storyTitle}
              </h1>
            )}
          </div>

          <div className={styles.headerStats}>
            <span className={styles.statItem}>
              <Clock size={11} />
              12 weeks
            </span>
            <span className={styles.statItem}>
              <BookOpen size={11} />
              {totalSections} section{totalSections !== 1 ? 's' : ''}
            </span>
            <span className={`${weeksWithContent > 0 ? styles.statHighlight : ''}`}>
              {weeksWithContent}/12 active
            </span>
          </div>
        </div>
      </header>

      <div className={styles.legend}>
        <div className={styles.legendRow}>
          <span className={styles.legendLabel}>Legend</span>
          {SECTION_TYPES.map((t) => (
            <span key={t} className={styles.legendItem}>
              <span className={`${styles.dot} ${SECTION_DOT_CLASS[t]}`} />
              {SECTION_LABELS[t]}
            </span>
          ))}
        </div>
      </div>

      <main className={styles.grid}>
        {weeks.map((week, i) => (
          <WeekCard
            key={week.id}
            week={week}
            index={i}
            onUpdate={updateWeek}
          />
        ))}
      </main>

      {totalSections === 0 && (
        <p className={styles.emptyState}>Click any week to begin your story.</p>
      )}
    </div>
  );
}
