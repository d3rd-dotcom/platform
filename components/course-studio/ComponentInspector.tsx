'use client';

import { useState, useEffect, useRef } from 'react';
import {
  TextT,
  CheckSquare,
  CaretDown,
  Image,
  Video,
  UploadSimple,
  Keyboard,
  Star,
  NotePencil,
  Question,
  FileText,
  Trash,
  X,
} from '@phosphor-icons/react';
import type { CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';
import styles from './ComponentInspector.module.css';

interface ComponentInspectorProps {
  component: CourseComponentRecord | null;
  onUpdate: (compId: string, updates: Partial<CourseComponentRecord>) => void;
  onDelete: (compId: string) => void;
  onClose: () => void;
}

const COMPONENT_ICONS: Record<ComponentType, React.ReactNode> = {
  rich_text: <TextT size={18} weight="bold" />,
  multiple_choice: <CheckSquare size={18} weight="bold" />,
  dropdown: <CaretDown size={18} weight="bold" />,
  image_embed: <Image size={18} weight="bold" />,
  video_embed: <Video size={18} weight="bold" />,
  file_upload: <UploadSimple size={18} weight="bold" />,
  text_input: <Keyboard size={18} weight="bold" />,
  rating_scale: <Star size={18} weight="bold" />,
  reflection_journal: <NotePencil size={18} weight="bold" />,
  quiz_block: <Question size={18} weight="bold" />,
  markdown_file: <FileText size={18} weight="bold" />,
};

const COMPONENT_LABELS: Record<ComponentType, string> = {
  rich_text: 'Rich Text',
  multiple_choice: 'Multiple Choice',
  dropdown: 'Dropdown',
  image_embed: 'Image',
  video_embed: 'Video',
  file_upload: 'File Upload',
  text_input: 'Text Input',
  rating_scale: 'Rating',
  reflection_journal: 'Journal',
  quiz_block: 'Quiz',
  markdown_file: 'Markdown',
};

const CONFIG_FIELDS: Record<ComponentType, Array<{
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'json';
  options?: { value: string; label: string }[];
  placeholder?: string;
}>> = {
  rich_text: [
    { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Write your content here...' },
    { key: 'format', label: 'Format', type: 'select', options: [{ value: 'markdown', label: 'Markdown' }, { value: 'html', label: 'HTML' }] },
  ],
  multiple_choice: [
    { key: 'question', label: 'Question', type: 'text' },
    { key: 'options', label: 'Options (JSON array)', type: 'json', placeholder: '[{"id":"1","text":"Option A","isCorrect":false}]' },
    { key: 'allowMultiple', label: 'Allow multiple', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    { key: 'showFeedback', label: 'Show feedback', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  ],
  dropdown: [
    { key: 'label', label: 'Label', type: 'text' },
    { key: 'placeholder', label: 'Placeholder', type: 'text' },
    { key: 'options', label: 'Options (JSON array)', type: 'json', placeholder: '[{"id":"1","value":"opt1","displayText":"Option 1"}]' },
    { key: 'required', label: 'Required', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  ],
  image_embed: [
    { key: 'url', label: 'Image URL', type: 'text', placeholder: 'https://...' },
    { key: 'alt', label: 'Alt text', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
    { key: 'width', label: 'Width', type: 'text', placeholder: '100%, 500px, auto' },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
  ],
  video_embed: [
    { key: 'url', label: 'Video URL', type: 'text', placeholder: 'https://youtube.com/watch?v=...' },
    { key: 'provider', label: 'Provider', type: 'select', options: [{ value: 'youtube', label: 'YouTube' }, { value: 'vimeo', label: 'Vimeo' }, { value: 'upload', label: 'Direct upload' }] },
    { key: 'transcript', label: 'Transcript', type: 'textarea' },
  ],
  file_upload: [
    { key: 'acceptedTypes', label: 'Accepted types (JSON array)', type: 'json', placeholder: '["image/png","application/pdf"]' },
    { key: 'maxSizeMb', label: 'Max size (MB)', type: 'number' },
    { key: 'multiple', label: 'Allow multiple', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  ],
  text_input: [
    { key: 'placeholder', label: 'Placeholder', type: 'text' },
    { key: 'maxLength', label: 'Max length', type: 'number' },
    { key: 'inputType', label: 'Input type', type: 'select', options: [{ value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }, { value: 'number', label: 'Number' }] },
    { key: 'validation', label: 'Validation (JSON)', type: 'json', placeholder: '{"required":true,"min":0,"max":100}' },
  ],
  rating_scale: [
    { key: 'min', label: 'Min', type: 'number' },
    { key: 'max', label: 'Max', type: 'number' },
    { key: 'step', label: 'Step', type: 'number' },
    { key: 'labels', label: 'Labels (JSON object)', type: 'json', placeholder: '{"1":"Poor","5":"Excellent"}' },
  ],
  reflection_journal: [
    { key: 'prompt', label: 'Prompt', type: 'textarea' },
    { key: 'minWords', label: 'Min words', type: 'number' },
    { key: 'saveEnabled', label: 'Auto-save', type: 'select', options: [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }] },
  ],
  quiz_block: [
    { key: 'timeLimitMinutes', label: 'Time limit (minutes)', type: 'number' },
    { key: 'passingScore', label: 'Passing score (%)', type: 'number' },
    { key: 'questions', label: 'Questions (JSON array)', type: 'json', placeholder: '[{"id":"q1","text":"Question?","options":[...]}]' },
  ],
  markdown_file: [
    { key: 'url', label: 'File URL', type: 'text', placeholder: 'https://...' },
    { key: 'originalName', label: 'Original filename', type: 'text' },
  ],
};

export default function ComponentInspector({ component, onUpdate, onDelete, onClose }: ComponentInspectorProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const componentId = component?.id;
  useEffect(() => {
    if (!componentId) return;
    setLocalConfig({});
    setJsonError(null);
  }, [componentId]);

  useEffect(() => {
    if (componentId && titleRef.current) {
      titleRef.current.focus();
    }
  }, [componentId]);

  if (!component) {
    return (
      <div className={styles.empty}>
        Select a component to edit
      </div>
    );
  }

  const fields = CONFIG_FIELDS[component.componentType] ?? [];

  const getConfigValue = (key: string): string => {
    if (localConfig[key] !== undefined) return localConfig[key];
    const val = (component.config as Record<string, unknown>)[key];
    if (val === undefined || val === null) return '';
    if (Array.isArray(val) || typeof val === 'object') return JSON.stringify(val, null, 2);
    return String(val);
  };

  const handleFieldChange = (key: string, value: string, type: string) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setJsonError(null);

    const updated = { ...component.config } as Record<string, unknown>;

    if (type === 'number') {
      updated[key] = value ? Number(value) : undefined;
    } else if (type === 'json') {
      if (!value.trim()) {
        updated[key] = undefined;
      } else {
        try {
          updated[key] = JSON.parse(value);
        } catch {
          setJsonError(`Invalid JSON for ${key}`);
          return;
        }
      }
    } else if (type === 'select') {
      updated[key] = value === 'true' ? true : value === 'false' ? false : value;
    } else {
      updated[key] = value;
    }

    onUpdate(component.id, { config: updated });
  };

  return (
    <div className={styles.inspector}>
      <div className={styles.inspectorHeader}>
        <div className={styles.inspectorHeaderLeft}>
          <span className={styles.inspectorTypeIcon}>
            {COMPONENT_ICONS[component.componentType]}
          </span>
          <div className={styles.inspectorHeaderMeta}>
            <span className={styles.inspectorType}>
              {COMPONENT_LABELS[component.componentType]}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.inspectorClose}
          onClick={onClose}
          title="Close"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className={styles.inspectorBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Title</label>
          <input
            ref={titleRef}
            value={component.title}
            onChange={(e) => onUpdate(component.id, { title: e.target.value })}
            className={styles.input}
            placeholder="Component title"
          />
        </div>

        <div className={styles.checkboxRow}>
          <input
            type="checkbox"
            id="required-check"
            checked={component.required}
            onChange={(e) => onUpdate(component.id, { required: e.target.checked })}
            className={styles.checkbox}
          />
          <label htmlFor="required-check" className={styles.checkboxLabel}>
            Required
          </label>
        </div>

        {fields.length > 0 && (
          <div className={styles.configSection}>
            <p className={styles.configHeading}>Configuration</p>
            {jsonError && (
              <p className={styles.jsonError}>{jsonError}</p>
            )}
            <div className={styles.fields}>
              {fields.map((field) => (
                <label key={field.key} className={styles.formField}>
                  <span className={styles.formFieldLabel}>{field.label}</span>
                  {field.type === 'textarea' || field.type === 'json' ? (
                    <textarea
                      value={getConfigValue(field.key)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                      placeholder={field.placeholder}
                      rows={field.type === 'json' ? 4 : 3}
                      className={`${styles.textarea} ${field.type === 'json' ? styles.textareaMono : ''}`}
                    />
                  ) : field.type === 'select' ? (
                    <select
                      value={getConfigValue(field.key)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                      className={styles.select}
                    >
                      <option value="">--</option>
                      {field.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : 'text'}
                      value={getConfigValue(field.key)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                      placeholder={field.placeholder}
                      className={styles.input}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className={styles.deleteSection}>
          <button
            type="button"
            onClick={() => onDelete(component.id)}
            className={styles.deleteBtn}
          >
            <Trash size={14} weight="bold" />
            Remove component
          </button>
        </div>
      </div>
    </div>
  );
}
