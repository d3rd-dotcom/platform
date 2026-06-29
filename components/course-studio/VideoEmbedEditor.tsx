'use client';

import { useState, useEffect } from 'react';
import { Trash } from '@phosphor-icons/react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './VideoEmbedEditor.module.css';

interface VideoEmbedEditorProps {
  component: CourseComponentRecord;
  onUpdate: (compId: string, updates: Partial<CourseComponentRecord>) => void;
  onDelete: (compId: string) => void;
}

export default function VideoEmbedEditor({ component, onUpdate, onDelete }: VideoEmbedEditorProps) {
  const config = component.config as Record<string, unknown>;
  const [title, setTitle] = useState(component.title);
  const [url, setUrl] = useState((config.url as string) ?? '');
  const [description, setDescription] = useState((config.description as string) ?? '');
  const [question, setQuestion] = useState((config.question as string) ?? '');
  const [answer, setAnswer] = useState((config.answer as string) ?? '');

  useEffect(() => {
    setTitle(component.title);
    setUrl((component.config?.url as string) ?? '');
    setDescription((component.config?.description as string) ?? '');
    setQuestion((component.config?.question as string) ?? '');
    setAnswer((component.config?.answer as string) ?? '');
  }, [component.id, component.title, component.config]);

  const commit = (updates: Record<string, unknown>) => {
    onUpdate(component.id, { ...updates });
  };

  const saveTitle = () => {
    if (title.trim() !== component.title) {
      commit({ title: title.trim() });
    }
  };

  const saveConfig = (field: string, value: string) => {
    onUpdate(component.id, { config: { ...component.config, [field]: value } });
  };

  return (
    <div className={styles.editor}>
      <div className={styles.header}>
        <span className={styles.accent} />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(); }}
          placeholder="Video title"
          className={styles.titleInput}
        />
        <button type="button" className={styles.deleteBtn} onClick={() => onDelete(component.id)} title="Delete">
          <Trash size={14} weight="bold" />
        </button>
      </div>

      <div className={styles.body}>
        <label className={styles.field}>
          <span className={styles.label}>Video Link</span>
          <input
            value={url}
            onChange={(e) => { setUrl(e.target.value); saveConfig('url', e.target.value); }}
            placeholder="https://youtube.com/watch?v=..."
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Description</span>
          <textarea
            value={description}
            onChange={(e) => { setDescription(e.target.value); saveConfig('description', e.target.value); }}
            placeholder="Describe what this video covers..."
            className={styles.textarea}
            rows={3}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelOptional}>Question (optional)</span>
          <input
            value={question}
            onChange={(e) => { setQuestion(e.target.value); saveConfig('question', e.target.value); }}
            placeholder="Ask a question about the video..."
            className={styles.input}
          />
        </label>

        <label className={styles.field}>
          <span className={styles.labelOptional}>Answer (optional)</span>
          <textarea
            value={answer}
            onChange={(e) => { setAnswer(e.target.value); saveConfig('answer', e.target.value); }}
            placeholder="Provide the answer..."
            className={styles.textarea}
            rows={2}
          />
        </label>
      </div>
    </div>
  );
}
