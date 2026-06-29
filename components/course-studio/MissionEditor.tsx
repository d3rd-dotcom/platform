'use client';

import { useState, useEffect } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import LegacyMissionRenderer from '@/components/course-renderers/LegacyMissionRenderer';
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
        <LegacyMissionRenderer
          component={component}
          onUpdate={(config) => onUpdate(component.id, { config })}
        />
      </div>
    </div>
  );
}
