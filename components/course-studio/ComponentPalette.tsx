'use client';

import { useDraggable } from '@dnd-kit/core';
import type { ComponentType } from '@/lib/vip-course-db';

const PALETTE_ITEMS: { type: ComponentType; label: string; icon: string }[] = [
  { type: 'rich_text', label: 'Rich Text', icon: 'Aa' },
  { type: 'multiple_choice', label: 'Multiple Choice', icon: '☑' },
  { type: 'dropdown', label: 'Dropdown', icon: '▾' },
  { type: 'image_embed', label: 'Image', icon: '🖼' },
  { type: 'video_embed', label: 'Video', icon: '▶' },
  { type: 'file_upload', label: 'File Upload', icon: '📎' },
  { type: 'text_input', label: 'Text Input', icon: '⌨' },
  { type: 'rating_scale', label: 'Rating Scale', icon: '★' },
  { type: 'reflection_journal', label: 'Journal', icon: '✎' },
  { type: 'quiz_block', label: 'Quiz', icon: '?' },
  { type: 'markdown_file', label: 'Markdown File', icon: '📄' },
];

function PaletteItem({ type, label, icon }: { type: ComponentType; label: string; icon: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${type}`,
    data: { type, source: 'palette' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 p-2 rounded-lg border cursor-grab transition-colors text-sm ${
        isDragging
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 opacity-50'
          : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:border-blue-400 hover:shadow-sm'
      }`}
    >
      <span className="text-base shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </div>
  );
}

export default function ComponentPalette() {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Components</p>
      {PALETTE_ITEMS.map((item) => (
        <PaletteItem key={item.type} {...item} />
      ))}
    </div>
  );
}
