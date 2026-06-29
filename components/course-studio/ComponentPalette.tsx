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
  { type: 'reflection_journal', label: 'Free Write', icon: <NotePencil size={18} weight="bold" />, description: 'Open-ended journal', config: { prompt: '', minWords: 0 } },
  { type: 'text_input', label: 'Numbered List', icon: <ListNumbers size={18} weight="bold" />, description: 'Numbered prompt list', config: { placeholder: 'Write your answer...' } },
  { type: 'text_input', label: 'Lists', icon: <Users size={18} weight="bold" />, description: 'Imaginary lives template', config: { placeholder: 'Write your answer...' } },
  { type: 'multiple_choice', label: 'Checklist', icon: <Clipboard size={18} weight="bold" />, description: 'Checklist of items', config: { question: '', options: [], selectMultiple: true } },
  { type: 'text_input', label: 'Enjoy List', icon: <Heart size={18} weight="bold" />, description: 'Things you enjoy', config: { placeholder: 'Something you enjoy...' } },
  { type: 'text_input', label: 'Gratitude', icon: <Sparkle size={18} weight="bold" />, description: 'Gratitude entries', config: { placeholder: 'I am grateful for...' } },
  { type: 'rating_scale', label: 'Sliders', icon: <Sliders size={18} weight="bold" />, description: 'Life domain sliders', config: { min: 0, max: 10, minLabel: 'Low', maxLabel: 'High' } },
  { type: 'video_embed', label: 'Video', icon: <Video size={18} weight="bold" />, description: 'Video link with description', config: { url: '', description: '', question: '', answer: '' } },
];

function PaletteItem({ type, label, icon, description, config, onAdd }: PaletteItemDef & { onAdd?: (type: ComponentType, config?: Record<string, unknown>) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
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
          <PaletteItem key={item.type} {...item} onAdd={onAddComponent} />
        ))}
      </div>
    </div>
  );
}
