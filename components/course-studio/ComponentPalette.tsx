'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ComponentType } from '@/lib/vip-course-db';
import styles from './ComponentPalette.module.css';

interface PaletteItemDef {
  type: ComponentType;
  label: string;
  icon: string;
  color: string;
  description: string;
}

const PALETTE_ITEMS: PaletteItemDef[] = [
  { type: 'rich_text', label: 'Knowledge Block', icon: '📖', color: '#B85C38', description: 'Markdown, HTML, or rich text' },
  { type: 'multiple_choice', label: 'Choice Gate', icon: '🚪', color: '#9370DB', description: 'Multiple choice question' },
  { type: 'dropdown', label: 'Drop Block', icon: '⬇️', color: '#20B2AA', description: 'Dropdown selector' },
  { type: 'image_embed', label: 'Image Block', icon: '🖼️', color: '#FF6B6B', description: 'Embed an image' },
  { type: 'video_embed', label: 'Vision Crystal', icon: '💎', color: '#4ECDC4', description: 'YouTube or Vimeo embed' },
  { type: 'file_upload', label: 'Supply Box', icon: '📦', color: '#DEB887', description: 'File upload field' },
  { type: 'text_input', label: 'Input Stone', icon: '⌨️', color: '#95E1D3', description: 'Free-text input' },
  { type: 'rating_scale', label: 'Star Meter', icon: '⭐', color: '#FFD700', description: 'Rating scale' },
  { type: 'reflection_journal', label: 'Reflection Log', icon: '✍️', color: '#F08080', description: 'Journal prompt' },
  { type: 'quiz_block', label: 'Power-Up Block', icon: '❓', color: '#FFA500', description: 'Timed quiz' },
  { type: 'markdown_file', label: 'Data Scroll', icon: '📄', color: '#A9A9A9', description: 'Remote markdown file' },
];

const SHADOW_COLORS: Record<string, string> = {
  '#B85C38': '#8B4513',
  '#9370DB': '#7B5DB8',
  '#20B2AA': '#178F88',
  '#FF6B6B': '#D94444',
  '#4ECDC4': '#36AFA7',
  '#DEB887': '#C4A265',
  '#95E1D3': '#6FC4B6',
  '#FFD700': '#D4B000',
  '#F08080': '#D46060',
  '#FFA500': '#D48900',
  '#A9A9A9': '#888888',
};

function PaletteItem({ type, label, icon, color, description }: PaletteItemDef) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, source: 'palette' },
  });

  const shadowColor = SHADOW_COLORS[color] ?? '#666';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`${styles.item} ${isDragging ? styles.itemDragging : ''}`}
      style={{
        background: `linear-gradient(145deg, ${color}, ${shadowColor})`,
        boxShadow: isDragging
          ? `0 12px 32px ${color}66, 0 0 0 2px #fff`
          : `0 4px 0 ${shadowColor}, 0 6px 12px ${color}33`,
      }}
    >
      <span className={styles.itemIcon}>{icon}</span>
      <span className={styles.itemLabel}>{label}</span>
      <span className={styles.itemDescription}>{description}</span>
    </div>
  );
}

export default function ComponentPalette() {
  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <span className={styles.headerIcon}>🎮</span>
        <span className={styles.headerTitle}>Item Shop</span>
      </div>
      <div className={styles.grid}>
        {PALETTE_ITEMS.map((item) => (
          <PaletteItem key={item.type} {...item} />
        ))}
      </div>
    </div>
  );
}
