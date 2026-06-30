'use client';

import { useState } from 'react';
import { Trash } from '@phosphor-icons/react';
import MultipleChoiceEditor from './MultipleChoiceEditor';
import styles from './ComponentConfigEditor.module.css';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

export default function ComponentConfigEditor({
  componentType,
  config,
  onUpdate,
}: {
  componentType: string;
  config: Record<string, unknown>;
  onUpdate: (config: Record<string, unknown>) => void;
}) {
  const patch = (next: Record<string, unknown>) => onUpdate({ ...config, ...next });

  switch (componentType) {
    case 'rich_text':
      return <RichTextEditor config={config} patch={patch} />;
    case 'image_embed':
    case 'media_embed':
      return <MediaEmbedEditor config={config} patch={patch} />;
    case 'video_embed':
      return <VideoEmbedEditor config={config} patch={patch} />;
    case 'text_input':
      return <TextInputEditor config={config} patch={patch} />;
    case 'multiple_choice':
      return <MultipleChoiceEditor config={config as any} onUpdate={onUpdate} />;
    case 'rating_scale':
      return <RatingScaleEditor config={config} patch={patch} />;
    case 'file_upload':
      return <FileUploadEditor config={config} patch={patch} />;
    case 'quiz_block':
      return <QuizBlockEditor config={config} patch={patch} />;
    case 'password_gate':
      return <PasswordGateEditor config={config} patch={patch} />;
    case 'reflection_journal':
      return <JournalEditor config={config} patch={patch} />;
    default:
      return <div className={styles.fallback}>No editor for {componentType}</div>;
  }
}

function RichTextEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Content</label>
      <textarea
        className={styles.textarea}
        value={(config.content as string) ?? ''}
        onChange={(e) => patch({ content: e.target.value })}
        placeholder="Write your content here... Supports markdown: # heading, ## subheading, - list items, plain paragraphs."
        rows={8}
      />
    </div>
  );
}

function MediaEmbedEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  const url = (config.url as string) ?? '';
  const isVideo = /(?:youtube\.com|youtu\.be|vimeo\.com)/i.test(url);
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Media URL</label>
      <input
        className={styles.input}
        value={url}
        onChange={(e) => patch({ url: e.target.value })}
        placeholder="Image URL or YouTube/Vimeo link"
      />
      {isVideo ? (
        <>
          <label className={styles.label}>Description</label>
          <textarea
            className={styles.textarea}
            value={(config.caption as string) ?? ''}
            onChange={(e) => patch({ caption: e.target.value })}
            placeholder="Optional description or transcript summary"
            rows={3}
          />
        </>
      ) : (
        <>
          <label className={styles.label}>Alt text</label>
          <input
            className={styles.input}
            value={(config.alt as string) ?? ''}
            onChange={(e) => patch({ alt: e.target.value })}
            placeholder="Describe the image for accessibility"
          />
          <label className={styles.label}>Caption</label>
          <input
            className={styles.input}
            value={(config.caption as string) ?? ''}
            onChange={(e) => patch({ caption: e.target.value })}
            placeholder="Optional caption shown below the media"
          />
        </>
      )}
    </div>
  );
}

function VideoEmbedEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Video URL</label>
      <input
        className={styles.input}
        value={(config.url as string) ?? ''}
        onChange={(e) => patch({ url: e.target.value })}
        placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
      />
      <label className={styles.label}>Description</label>
      <textarea
        className={styles.textarea}
        value={(config.description as string) ?? ''}
        onChange={(e) => patch({ description: e.target.value })}
        placeholder="Optional description or transcript summary"
        rows={3}
      />
    </div>
  );
}

function TextInputEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Placeholder text</label>
      <input
        className={styles.input}
        value={(config.placeholder as string) ?? ''}
        onChange={(e) => patch({ placeholder: e.target.value })}
        placeholder="e.g. Enter your response..."
      />
      <label className={styles.label}>Max characters</label>
      <input
        type="number"
        className={styles.inputSmall}
        value={(config.maxLength as number) ?? 500}
        onChange={(e) => patch({ maxLength: parseInt(e.target.value) || 500 })}
        min={1}
        max={9999}
      />
    </div>
  );
}

function RatingScaleEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Min value</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config.min as number) ?? 1}
            onChange={(e) => patch({ min: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Max value</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config.max as number) ?? 5}
            onChange={(e) => patch({ max: parseInt(e.target.value) || 5 })}
          />
        </div>
      </div>
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Min label</label>
          <input
            className={styles.input}
            value={(config.minLabel as string) ?? ''}
            onChange={(e) => patch({ minLabel: e.target.value })}
            placeholder="e.g. Not likely"
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Max label</label>
          <input
            className={styles.input}
            value={(config.maxLabel as string) ?? ''}
            onChange={(e) => patch({ maxLabel: e.target.value })}
            placeholder="e.g. Very likely"
          />
        </div>
      </div>
    </div>
  );
}

function FileUploadEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  const types = (config.acceptedTypes as string[]) ?? [];
  const typesStr = types.join(', ');

  return (
    <div className={styles.editor}>
      <label className={styles.label}>Accepted file types</label>
      <input
        className={styles.input}
        value={typesStr}
        onChange={(e) => patch({ acceptedTypes: e.target.value ? e.target.value.split(',').map((s) => s.trim()) : [] })}
        placeholder="pdf, doc, jpg, png (comma-separated, or * for all)"
      />
      <label className={styles.label}>Max size (MB)</label>
      <input
        type="number"
        className={styles.inputSmall}
        value={(config.maxSizeMb as number) ?? 10}
        onChange={(e) => patch({ maxSizeMb: parseInt(e.target.value) || 10 })}
        min={1}
        max={100}
      />
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={(config.multiple as boolean) ?? false}
          onChange={(e) => patch({ multiple: e.target.checked })}
        />
        Allow multiple files
      </label>
    </div>
  );
}

function QuizBlockEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  const questions = (config.questions as Array<{ id: string; text: string; options: Option[] }>) ?? [];

  const setQuestions = (qs: typeof questions) => patch({ questions: qs });

  const addQuestion = () =>
    setQuestions([
      ...questions,
      { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', options: [] },
    ]);

  const removeQuestion = (id: string) => setQuestions(questions.filter((q) => q.id !== id));

  const updateQuestion = (id: string, text: string) =>
    setQuestions(questions.map((q) => (q.id === id ? { ...q, text } : q)));

  const addOption = (qId: string) =>
    setQuestions(
      questions.map((q) =>
        q.id === qId
          ? { ...q, options: [...q.options, { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', isCorrect: false }] }
          : q,
      ),
    );

  const removeOption = (qId: string, optId: string) =>
    setQuestions(
      questions.map((q) => (q.id === qId ? { ...q, options: q.options.filter((o) => o.id !== optId) } : q)),
    );

  const updateOption = (qId: string, optId: string, text: string) =>
    setQuestions(
      questions.map((q) =>
        q.id === qId ? { ...q, options: q.options.map((o) => (o.id === optId ? { ...o, text } : o)) } : q,
      ),
    );

  const toggleCorrect = (qId: string, optId: string) =>
    setQuestions(
      questions.map((q) =>
        q.id === qId
          ? { ...q, options: q.options.map((o) => ({ ...o, isCorrect: o.id === optId ? !o.isCorrect : o.isCorrect })) }
          : q,
      ),
    );

  return (
    <div className={styles.editor}>
      <div className={styles.row}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Time limit (minutes)</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config.timeLimitMinutes as number) ?? 10}
            onChange={(e) => patch({ timeLimitMinutes: parseInt(e.target.value) || 0 })}
            min={0}
          />
        </div>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Passing score (%)</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config.passingScore as number) ?? 80}
            onChange={(e) => patch({ passingScore: parseInt(e.target.value) || 80 })}
            min={0}
            max={100}
          />
        </div>
      </div>

      <div className={styles.sectionHeader}>
        <label className={styles.label}>Questions</label>
      </div>

      {questions.map((q, qi) => (
        <div key={q.id} className={styles.questionCard}>
          <div className={styles.questionHeader}>
            <span className={styles.questionNumber}>Q{qi + 1}</span>
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => removeQuestion(q.id)}
              title="Remove question"
            >
              <Trash size={12} weight="bold" />
            </button>
          </div>
          <input
            className={styles.input}
            value={q.text}
            onChange={(e) => updateQuestion(q.id, e.target.value)}
            placeholder="Enter your question..."
          />
          {q.options.map((opt) => (
            <div key={opt.id} className={styles.optionRow}>
              <input
                type="radio"
                name={`correct-${q.id}`}
                checked={opt.isCorrect}
                onChange={() => toggleCorrect(q.id, opt.id)}
                className={styles.radioInput}
              />
              <input
                className={styles.input}
                value={opt.text}
                onChange={(e) => updateOption(q.id, opt.id, e.target.value)}
                placeholder="Option text..."
              />
              <button
                type="button"
                className={styles.removeBtnSmall}
                onClick={() => removeOption(q.id, opt.id)}
                title="Remove option"
              >
                <Trash size={10} weight="bold" />
              </button>
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={() => addOption(q.id)}>
            + Add option
          </button>
        </div>
      ))}
      <button type="button" className={styles.addBtn} onClick={addQuestion}>
        + Add question
      </button>
    </div>
  );
}

function PasswordGateEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Password</label>
      <input
        className={styles.input}
        type="text"
        value={(config.password as string) ?? ''}
        onChange={(e) => patch({ password: e.target.value })}
        placeholder="Set a password learners must enter"
      />
      <label className={styles.label}>Hint</label>
      <input
        className={styles.input}
        value={(config.hint as string) ?? ''}
        onChange={(e) => patch({ hint: e.target.value })}
        placeholder="e.g. Hint: it was mentioned in Week 1 reading"
      />
    </div>
  );
}

function JournalEditor({ config, patch }: { config: Record<string, unknown>; patch: (n: Record<string, unknown>) => void }) {
  return (
    <div className={styles.editor}>
      <label className={styles.label}>Prompt</label>
      <textarea
        className={styles.textarea}
        value={(config.prompt as string) ?? ''}
        onChange={(e) => patch({ prompt: e.target.value })}
        placeholder="Write the reflection prompt for this journal entry..."
        rows={4}
      />
      <label className={styles.label}>Minimum words</label>
      <input
        type="number"
        className={styles.inputSmall}
        value={(config.minWords as number) ?? 0}
        onChange={(e) => patch({ minWords: parseInt(e.target.value) || 0 })}
        min={0}
        max={10000}
      />
    </div>
  );
}
