'use client';

import { useState, useEffect } from 'react';
import { Trash, NotePencil } from '@phosphor-icons/react';
import type { CourseComponentRecord, MissionBlockRecord, ComponentType } from '@/lib/vip-course-db';
import ComponentConfigEditor from './ComponentConfigEditor';
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
  onAddBlock?: (blockType: ComponentType, config?: Record<string, unknown>) => void;
  onUpdateBlock?: (blockId: string, updates: Partial<MissionBlockRecord>) => void;
  onDeleteBlock?: (blockId: string) => void;
}

const BLOCK_LABELS: Record<string, string> = {
  rich_text: 'Rich Text',
  text_input: 'Text Input',
  multiple_choice: 'Multiple Choice',
  rating_scale: 'Rating Scale',
  image_embed: 'Image',
  video_embed: 'Video',
  reflection_journal: 'Journal',
  file_upload: 'File Upload',
  quiz_block: 'Quiz',
  password_gate: 'Password Gate',
};

export default function MissionEditor({ component, onUpdate, onDelete, onAddBlock, onUpdateBlock, onDeleteBlock }: MissionEditorProps) {
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
  const blocks = component.blocks || [];

  return (
    <div className={styles.editor}>
      <div className={styles.taskCardHeader}>
        <span className={styles.taskAccent} aria-hidden="true" />
        <span className={`${styles.taskArtwork} ${styles[`taskArtwork${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''}`} aria-hidden="true" />
        <div className={styles.titleWrapper}>
          <NotePencil size={12} className={styles.titleEditIcon} weight="bold" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveTitle(); }}
            placeholder="Mission title"
            className={styles.titleInput}
          />
        </div>
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={() => onDelete(component.id)}
          title="Delete mission"
        >
          <Trash size={14} weight="bold" />
        </button>
      </div>

      <div className={styles.taskCardContent}>
        {blocks.length === 0 && (
          <div className={styles.emptyBlocks}>
            <p className={styles.emptyBlocksText}>No blocks yet. Add one from the palette below.</p>
          </div>
        )}

        {blocks.map((block) => (
          <div key={block.id} className={styles.blockCard}>
            <div className={styles.blockHeader}>
              <span className={styles.blockBadge}>{BLOCK_LABELS[block.blockType] || block.blockType}</span>
              {onDeleteBlock && (
                <button
                  type="button"
                  className={styles.blockDeleteBtn}
                  onClick={() => onDeleteBlock(block.id)}
                  title="Remove block"
                >
                  <Trash size={12} weight="bold" />
                </button>
              )}
            </div>
            <div className={styles.blockBody}>
              <ComponentConfigEditor
                componentType={block.blockType}
                config={block.config}
                onUpdate={(config) => onUpdateBlock?.(block.id, { config })}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
