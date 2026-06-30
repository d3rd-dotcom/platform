'use client';

import { useDraggable } from '@dnd-kit/core';
import {
  TextT,
  Clipboard,
  Sliders,
  Video,
  NotePencil,
  UploadSimple,
  Question,
  Lock,
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
  {
    type: 'text_input',
    label: 'Text Input',
    icon: <TextT size={18} weight="bold" />,
    description: 'Single text field',
    config: { placeholder: 'Enter your response...', maxLength: 500 },
  },
  {
    type: 'multiple_choice',
    label: 'Multiple Choice',
    icon: <Clipboard size={18} weight="bold" />,
    description: 'Quiz with selectable options',
    config: {
      question: '',
      options: [
        { id: 'opt-1', text: '', isCorrect: true },
        { id: 'opt-2', text: '', isCorrect: false },
      ],
      selectMultiple: false,
    },
  },
  {
    type: 'rating_scale',
    label: 'Rating Scale',
    icon: <Sliders size={18} weight="bold" />,
    description: 'Rate on a numeric scale',
    config: { min: 1, max: 5, minLabel: 'Low', maxLabel: 'High' },
  },
  {
    type: 'media_embed',
    label: 'Media',
    icon: <Video size={18} weight="bold" />,
    description: 'Image or video embed',
    config: { url: '', alt: '', caption: '' },
  },
  {
    type: 'reflection_journal',
    label: 'Field Notes',
    icon: <NotePencil size={18} weight="bold" />,
    description: 'Open-ended reflection prompt',
    config: { prompt: '', minWords: 0 },
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    icon: <UploadSimple size={18} weight="bold" />,
    description: 'Accept file submissions',
    config: { acceptedTypes: [], maxSizeMb: 10, multiple: false },
  },
  {
    type: 'quiz_block',
    label: 'Quiz',
    icon: <Question size={18} weight="bold" />,
    description: 'Timed quiz assessment',
    config: {
      timeLimitMinutes: 10,
      passingScore: 80,
      questions: [
        {
          id: 'q-default',
          text: '',
          options: [
            { id: 'q-opt-1', text: '', isCorrect: true },
            { id: 'q-opt-2', text: '', isCorrect: false },
          ],
        },
      ],
    },
  },
  {
    type: 'nft_gate',
    label: 'NFT Gate',
    icon: <Lock size={18} weight="bold" />,
    description: 'NFT-gated content',
    config: { collection: 'academic_angels', contractAddress: '' },
  },
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
