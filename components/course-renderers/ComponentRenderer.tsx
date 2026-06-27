'use client';

import dynamic from 'next/dynamic';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './ComponentRenderer.module.css';

const RichTextRenderer = dynamic(() => import('./RichTextRenderer'), { ssr: false });
const MultipleChoiceRenderer = dynamic(() => import('./MultipleChoiceRenderer'), { ssr: false });
const ImageEmbedRenderer = dynamic(() => import('./ImageEmbedRenderer'), { ssr: false });
const VideoEmbedRenderer = dynamic(() => import('./VideoEmbedRenderer'), { ssr: false });
const FileUploadRenderer = dynamic(() => import('./FileUploadRenderer'), { ssr: false });
const TextInputRenderer = dynamic(() => import('./TextInputRenderer'), { ssr: false });
const RatingScaleRenderer = dynamic(() => import('./RatingScaleRenderer'), { ssr: false });
const ReflectionJournalRenderer = dynamic(() => import('./ReflectionJournalRenderer'), { ssr: false });
const QuizBlockRenderer = dynamic(() => import('./QuizBlockRenderer'), { ssr: false });

function UnknownRenderer({ component }: { component: CourseComponentRecord }) {
  return (
    <div className={styles.unknown_warning}>
      Unknown component type: <code>{component.componentType}</code>
    </div>
  );
}

type RendererProps = { component: CourseComponentRecord; onComponentUpdate?: (updates: Partial<CourseComponentRecord>) => void };

const RENDERER_MAP: Record<string, React.ComponentType<RendererProps>> = {
  rich_text: RichTextRenderer as React.ComponentType<RendererProps>,
  multiple_choice: MultipleChoiceRenderer as React.ComponentType<RendererProps>,
  image_embed: ImageEmbedRenderer as React.ComponentType<RendererProps>,
  video_embed: VideoEmbedRenderer as React.ComponentType<RendererProps>,
  file_upload: FileUploadRenderer as React.ComponentType<RendererProps>,
  text_input: TextInputRenderer as React.ComponentType<RendererProps>,
  rating_scale: RatingScaleRenderer as React.ComponentType<RendererProps>,
  reflection_journal: ReflectionJournalRenderer as React.ComponentType<RendererProps>,
  quiz_block: QuizBlockRenderer as React.ComponentType<RendererProps>,
};

export default function ComponentRenderer({
  component,
  onComponentUpdate,
}: RendererProps) {
  const Renderer = RENDERER_MAP[component.componentType] ?? UnknownRenderer;
  return <Renderer component={component} onComponentUpdate={onComponentUpdate} />;
}
