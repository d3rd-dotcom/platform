'use client';

import dynamic from 'next/dynamic';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ComponentRenderer.module.css';

// Lazy-load each renderer so only the needed one is fetched
const RichTextRenderer = dynamic(() => import('./RichTextRenderer'), { ssr: false });
const MultipleChoiceRenderer = dynamic(() => import('./MultipleChoiceRenderer'), { ssr: false });
const DropdownRenderer = dynamic(() => import('./DropdownRenderer'), { ssr: false });
const ImageEmbedRenderer = dynamic(() => import('./ImageEmbedRenderer'), { ssr: false });
const VideoEmbedRenderer = dynamic(() => import('./VideoEmbedRenderer'), { ssr: false });
const FileUploadRenderer = dynamic(() => import('./FileUploadRenderer'), { ssr: false });
const TextInputRenderer = dynamic(() => import('./TextInputRenderer'), { ssr: false });
const RatingScaleRenderer = dynamic(() => import('./RatingScaleRenderer'), { ssr: false });
const ReflectionJournalRenderer = dynamic(() => import('./ReflectionJournalRenderer'), { ssr: false });
const QuizBlockRenderer = dynamic(() => import('./QuizBlockRenderer'), { ssr: false });
const MarkdownFileRenderer = dynamic(() => import('./MarkdownFileRenderer'), { ssr: false });

function UnknownRenderer({ component }: { component: CourseComponentRecord }) {
  return (
    <div className={styles.unknown_warning}>
      Unknown component type: <code>{component.componentType}</code>
    </div>
  );
}

const RENDERER_MAP: Record<string, React.ComponentType<{ component: CourseComponentRecord }>> = {
  rich_text: RichTextRenderer,
  multiple_choice: MultipleChoiceRenderer,
  dropdown: DropdownRenderer,
  image_embed: ImageEmbedRenderer,
  video_embed: VideoEmbedRenderer,
  file_upload: FileUploadRenderer,
  text_input: TextInputRenderer,
  rating_scale: RatingScaleRenderer,
  reflection_journal: ReflectionJournalRenderer,
  quiz_block: QuizBlockRenderer,
  markdown_file: MarkdownFileRenderer,
};

export default function ComponentRenderer({ component }: { component: CourseComponentRecord }) {
  const Renderer = RENDERER_MAP[component.componentType] ?? UnknownRenderer;
  return <Renderer component={component} />;
}
