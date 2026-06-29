'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  NotePencil,
  ListNumbers,
  Heart,
  Users,
  Clipboard,
  Sliders,
  Sparkle,
  Video,
} from '@phosphor-icons/react';
import type { ComponentType } from '@/lib/vip-course-db';
import styles from './ComponentPalette.module.css';

interface PaletteItemDef {
  type: ComponentType;
  label: string;
  icon: React.ReactNode;
  description: string;
  config?: Record<string, unknown>;
}

interface ComponentPaletteProps {
  onAddComponent?: (type: ComponentType, config?: Record<string, unknown>) => void;
}

const MISSION_ITEMS: PaletteItemDef[] = [
  { type: 'reflection_journal', label: 'Free Write', icon: <NotePencil size={18} weight="bold" />, description: 'Open-ended journal', config: { legacyType: 'text' } },
  { type: 'text_input', label: 'Numbered List', icon: <ListNumbers size={18} weight="bold" />, description: 'Numbered prompt list', config: { legacyType: 'numbered-list', listCount: 5, labels: ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'] } },
  { type: 'text_input', label: 'Lives', icon: <Users size={18} weight="bold" />, description: 'Five imaginary lives', config: { legacyType: 'lives', listLabels: ['Life 1', 'Life 2', 'Life 3', 'Life 4', 'Life 5'] } },
  { type: 'multiple_choice', label: 'Checklist', icon: <Clipboard size={18} weight="bold" />, description: 'Checklist of items', config: { legacyType: 'checklist', checkItems: [] } },
  { type: 'text_input', label: 'Enjoy List', icon: <Heart size={18} weight="bold" />, description: '20 things you enjoy', config: { legacyType: 'enjoy-list', count: 20 } },
  { type: 'text_input', label: 'Affirmations', icon: <Sparkle size={18} weight="bold" />, description: 'Daily affirmations', config: { legacyType: 'affirmations', count: 3 } },
  { type: 'rating_scale', label: 'Life Pie', icon: <Sliders size={18} weight="bold" />, description: '6 life domain sliders', config: { legacyType: 'life-pie', min: 0, max: 10, labels: ['Values', 'Exercise', 'Play', 'Work', 'Friends', 'Romance'] } },
  { type: 'video_embed', label: 'Video', icon: <Video size={18} weight="bold" />, description: 'Video link with description', config: { url: '', description: '', question: '', answer: '' } },
];

function PaletteItem({ type, label, icon, description, config, onAdd }: PaletteItemDef & { onAdd?: (type: ComponentType, config?: Record<string, unknown>) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}${config?.legacyType ? '-' + config.legacyType : ''}`,
    data: { type, source: 'palette', config, paletteLabel: label },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
      onClick={() => onAdd?.(type, config)}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <div className={styles.itemInfo}>
        <span className={styles.itemLabel}>{label}</span>
      </div>
    </div>
  );
}

export default function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  return (
    <div className={styles.section}>
      <div className={styles.grid}>
        {MISSION_ITEMS.map((item) => (
          <PaletteItem key={item.config?.legacyType as string} {...item} onAdd={onAddComponent} />
        ))}
      </div>
    </div>
  );
}
