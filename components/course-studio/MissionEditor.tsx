'use client';

import { useState, useEffect, useMemo } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import LegacyMissionRenderer from '@/components/course-renderers/LegacyMissionRenderer';
import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import styles from './MissionEditor.module.css';

const ARTWORK_VARIANTS = ['aurora', 'sunrise', 'orbit', 'bloom', 'ribbon', 'prism'];

function getArtworkVariant(id: string): string {
  const variants = ARTWORK_VARIANTS;
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return variants[Math.abs(hash) % variants.length];
}

interface MissionEditorProps {
  component: CourseComponentRecord;
  onUpdate: (compId: string, updates: Partial<CourseComponentRecord>) => void;
  onDelete: (compId: string) => void;
}

/* ── Legacy translation for component types without direct editors ── */

const LEGACY_EDITORS: Record<string, {
  legacyType: string;
  toLegacy: (cfg: Record<string, unknown>) => Record<string, unknown>;
  fromLegacy: (cfg: Record<string, unknown>) => Record<string, unknown>;
}> = {
  reflection_journal: {
    legacyType: 'text',
    toLegacy: (cfg) => ({ ...cfg, legacyType: 'text', text: (cfg.prompt as string) ?? '' }),
    fromLegacy: (cfg) => {
      const { legacyType, text, ...rest } = cfg;
      return { ...rest, prompt: text };
    },
  },
  text_input: {
    legacyType: 'text',
    toLegacy: (cfg) => ({ ...cfg, legacyType: 'text', text: (cfg.placeholder as string) ?? '' }),
    fromLegacy: (cfg) => {
      const { legacyType, text, ...rest } = cfg;
      return { ...rest, placeholder: text };
    },
  },
};

export default function MissionEditor({ component, onUpdate, onDelete }: MissionEditorProps) {
  const [title, setTitle] = useState(component.title);

  useEffect(() => {
    setTitle(component.title);
  }, [component.id, component.title]);

  const handleSaveTitle = () => {
    if (title.trim() !== component.title) {
      onUpdate(component.id, { title: title.trim() });
    }
  };

  const variant = getArtworkVariant(component.id);

  // Translate non-legacy components for LegacyMissionRenderer
  const showLegacyEditor = !!component.config?.legacyType;
  const legacyMapping = LEGACY_EDITORS[component.componentType];

  const editorComponent = useMemo<CourseComponentRecord>(() => {
    if (showLegacyEditor || !legacyMapping) return component;
    return {
      ...component,
      config: legacyMapping.toLegacy(component.config ?? {}),
    };
  }, [component, showLegacyEditor, legacyMapping]);

  const handleLegacyUpdate = (config: Record<string, unknown>) => {
    if (showLegacyEditor) {
      onUpdate(component.id, { config });
    } else if (legacyMapping) {
      onUpdate(component.id, { config: legacyMapping.fromLegacy(config) });
    }
  };

  return (
    <div className={styles.editor}>
      {/* Task card header — mirrors /course expanded task card */}
      <div className={styles.taskCardHeader}>
        <span className={styles.taskAccent} aria-hidden="true" />
        <span className={`${styles.taskArtwork} ${styles[`taskArtwork${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''}`} aria-hidden="true" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleSaveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); }}
          placeholder="Mission title"
          className={styles.titleInput}
        />
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => onDelete(component.id)}
          title="Delete mission"
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>

      {/* Expanded content — the actual mission component */}
      <div className={styles.taskCardContent}>
        {showLegacyEditor || legacyMapping ? (
          <LegacyMissionRenderer
            component={editorComponent}
            onUpdate={handleLegacyUpdate}
          />
        ) : (
          <ComponentRenderer component={component as any} />
        )}
      </div>
    </div>
  );
}
