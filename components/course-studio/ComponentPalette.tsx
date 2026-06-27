'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  TextT,
  CheckSquare,
  Image,
  Video,
  UploadSimple,
  Keyboard,
  Star,
  NotePencil,
  Question,
} from '@phosphor-icons/react';
import type { ComponentType } from '@/lib/vip-course-db';
import styles from './ComponentPalette.module.css';

interface PaletteItemDef {
  type: ComponentType;
  label: string;
  icon: React.ReactNode;
  description: string;
}

interface ComponentPaletteProps {
  onAddComponent?: (type: ComponentType) => void;
}

const PALETTE_ITEMS: PaletteItemDef[] = [
  { type: 'rich_text', label: 'Rich Text', icon: <TextT size={18} weight="bold" />, description: 'Markdown or HTML content' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: <CheckSquare size={18} weight="bold" />, description: 'Multi-select question' },
  { type: 'image_embed', label: 'Image', icon: <Image size={18} weight="bold" />, description: 'Embed an image' },
  { type: 'video_embed', label: 'Video', icon: <Video size={18} weight="bold" />, description: 'YouTube or Vimeo embed' },
  { type: 'file_upload', label: 'File Upload', icon: <UploadSimple size={18} weight="bold" />, description: 'File upload field' },
  { type: 'text_input', label: 'Text Input', icon: <Keyboard size={18} weight="bold" />, description: 'Free-text input' },
  { type: 'rating_scale', label: 'Rating', icon: <Star size={18} weight="bold" />, description: 'Rating scale' },
  { type: 'reflection_journal', label: 'Journal', icon: <NotePencil size={18} weight="bold" />, description: 'Journal prompt' },
  { type: 'quiz_block', label: 'Quiz', icon: <Question size={18} weight="bold" />, description: 'Timed quiz' },
];

function PaletteItem({ type, label, icon, description, onAdd }: PaletteItemDef & { onAdd?: (type: ComponentType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, source: 'palette' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
      onClick={() => onAdd?.(type)}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <div className={styles.itemInfo}>
        <span className={styles.itemLabel}>{label}</span>
        <span className={styles.itemDescription}>{description}</span>
      </div>
    </div>
  );
}

export default function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>Components</span>
        <span className={styles.headerCount}>{PALETTE_ITEMS.length}</span>
      </div>

      <div className={styles.grid}>
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} {...item} onAdd={onAddComponent} />
        ))}
      </div>
    </div>
  );
}
