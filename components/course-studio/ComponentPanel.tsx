'use client';

import { useState, useEffect, useRef } from 'react';
import {
  TextT,
  CheckSquare,
  Image,
  Video,
  UploadSimple,
  Keyboard,
  Star,
  NotePencil,
  Question,
  Television,
  Trash,
  X,
  Plus,
  Minus,
  CheckCircle,
} from '@phosphor-icons/react';
import type { CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';
import styles from './ComponentPanel.module.css';

interface ComponentPanelProps {
  component: CourseComponentRecord | null;
  onUpdate: (compId: string, updates: Partial<CourseComponentRecord>) => void;
  onDelete: (compId: string) => void;
  onClose: () => void;
}

const COMPONENT_ICONS: Record<ComponentType, React.ReactNode> = {
  rich_text: <TextT size={18} weight="bold" />,
  multiple_choice: <CheckSquare size={18} weight="bold" />,
  image_embed: <Image size={18} weight="bold" />,
  video_embed: <Video size={18} weight="bold" />,
  file_upload: <UploadSimple size={18} weight="bold" />,
  text_input: <Keyboard size={18} weight="bold" />,
  rating_scale: <Star size={18} weight="bold" />,
  reflection_journal: <NotePencil size={18} weight="bold" />,
  quiz_block: <Question size={18} weight="bold" />,
};

const COMPONENT_LABELS: Record<ComponentType, string> = {
  rich_text: 'Rich Text',
  multiple_choice: 'Multiple Choice',
  image_embed: 'Image',
  video_embed: 'Video',
  file_upload: 'File Upload',
  text_input: 'Text Input',
  rating_scale: 'Rating',
  reflection_journal: 'Journal',
  quiz_block: 'Quiz',
};

const CONFIG_FIELDS: Record<ComponentType, Array<{
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: { value: string; label: string }[];
  placeholder?: string;
}>> = {
  rich_text: [
    { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Write a paragraph, paste a video link, or embed markdown...' },
  ],
  multiple_choice: [
    { key: 'question', label: 'Question', type: 'text', placeholder: 'Enter your question here' },
    { key: 'options', label: 'Options', type: 'text' },
    { key: 'selectMultiple', label: 'Allow selecting multiple', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
    { key: 'revealAnswers', label: 'Reveal correct answers', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  ],
  image_embed: [
    { key: 'url', label: 'Image URL', type: 'text', placeholder: 'Paste an image URL...' },
    { key: 'alt', label: 'Alt text', type: 'text', placeholder: 'Describe the image for accessibility' },
    { key: 'caption', label: 'Caption', type: 'text', placeholder: 'Optional caption shown below the image' },
    { key: 'width', label: 'Width', type: 'text', placeholder: '100%, 500px, auto' },
    { key: 'alignment', label: 'Alignment', type: 'select', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
  ],
  video_embed: [
    { key: 'url', label: 'Video URL', type: 'text', placeholder: 'Paste a YouTube or Vimeo URL...' },
    { key: 'provider', label: 'Provider', type: 'select', options: [{ value: 'youtube', label: 'YouTube' }, { value: 'vimeo', label: 'Vimeo' }, { value: 'upload', label: 'Direct upload' }] },
    { key: 'transcript', label: 'Transcript', type: 'textarea', placeholder: 'Paste a transcript for accessibility' },
  ],
  file_upload: [
    { key: 'maxSizeMb', label: 'Max size (MB)', type: 'number', placeholder: 'Default is 10' },
    { key: 'multiple', label: 'Allow multiple', type: 'select', options: [{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }] },
  ],
  text_input: [
    { key: 'placeholder', label: 'Placeholder', type: 'text', placeholder: 'e.g. Enter your answer here' },
    { key: 'maxLength', label: 'Max length', type: 'number', placeholder: 'Max characters allowed' },
    { key: 'inputType', label: 'Input type', type: 'select', options: [{ value: 'text', label: 'Text' }, { value: 'email', label: 'Email' }, { value: 'number', label: 'Number' }] },
  ],
  rating_scale: [
    { key: 'min', label: 'Min', type: 'number', placeholder: '1' },
    { key: 'max', label: 'Max', type: 'number', placeholder: '5' },
    { key: 'step', label: 'Step', type: 'number', placeholder: '1' },
    { key: 'minLabel', label: 'Min label', type: 'text', placeholder: 'e.g. Poor' },
    { key: 'maxLabel', label: 'Max label', type: 'text', placeholder: 'e.g. Excellent' },
  ],
  reflection_journal: [
    { key: 'prompt', label: 'Prompt', type: 'textarea', placeholder: 'Write a prompt to guide the reflection...' },
    { key: 'minWords', label: 'Min words', type: 'number', placeholder: 'Minimum word count' },
    { key: 'saveEnabled', label: 'Auto-save', type: 'select', options: [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }] },
  ],
  quiz_block: [
    { key: 'timeLimitMinutes', label: 'Time limit (minutes)', type: 'number', placeholder: 'Leave empty for no limit' },
    { key: 'passingScore', label: 'Passing score (%)', type: 'number', placeholder: 'e.g. 80' },
  ],
};

function MultipleChoiceEditor({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [options, setOptions] = useState<Array<{ id: string; text: string; isCorrect: boolean }>>(() => {
    try {
      const parsed = JSON.parse(value || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const sync = (opts: Array<{ id: string; text: string; isCorrect: boolean }>) => {
    setOptions(opts);
    onChange(JSON.stringify(opts));
  };

  const addOption = () => {
    const label = String.fromCharCode(65 + options.length);
    sync([...options, { id: String(Date.now()), text: `Option ${label}`, isCorrect: false }]);
  };

  const updateOption = (id: string, updates: Partial<{ text: string; isCorrect: boolean }>) => {
    sync(options.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };

  const removeOption = (id: string) => {
    sync(options.filter((o) => o.id !== id));
  };

  const correctCount = options.filter((o) => o.isCorrect).length;

  return (
    <div className={styles.optionsEditor}>
      {options.length === 0 && (
        <p className={styles.optionsEmpty}>No options yet</p>
      )}
      {options.map((opt, i) => {
        const label = String.fromCharCode(65 + i);
        return (
          <div
            key={opt.id}
            className={`${styles.optionRow} ${opt.isCorrect ? styles.optionRowCorrect : ''}`}
          >
            <span className={styles.optionLabel}>{label}</span>
            <input
              type="text"
              value={opt.text}
              onChange={(e) => updateOption(opt.id, { text: e.target.value })}
              placeholder={`Option ${label}`}
              className={styles.optionInput}
            />
            <button
              type="button"
              className={styles.optionMarkBtn}
              onClick={() => updateOption(opt.id, { isCorrect: !opt.isCorrect })}
              title={opt.isCorrect ? 'Correct answer' : 'Mark as correct'}
            >
              <CheckCircle
                size={16}
                weight={opt.isCorrect ? 'fill' : 'regular'}
                className={opt.isCorrect ? styles.optionMarkIconActive : styles.optionMarkIcon}
              />
            </button>
            <button
              type="button"
              className={styles.optionRemove}
              onClick={() => removeOption(opt.id)}
              title="Remove option"
            >
              <Minus size={12} weight="bold" />
            </button>
          </div>
        );
      })}
      <button type="button" className={styles.optionAdd} onClick={addOption}>
        <Plus size={12} weight="bold" />
        Add option
      </button>
      {correctCount > 1 && (
        <p className={styles.optionsHint}>Multiple options marked correct — student must select all</p>
      )}
    </div>
  );
}

export default function ComponentPanel({ component, onUpdate, onDelete, onClose }: ComponentPanelProps) {
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
        <Television size={36} weight="light" className={styles.emptyIcon} />
        <p className={styles.emptyText}>Drag components from the palette onto a week to build your course</p>
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

  const getConfigNum = (key: string): number | undefined => {
    const raw = getConfigValue(key);
    if (!raw) return undefined;
    const n = Number(raw);
    return isNaN(n) ? undefined : n;
  };

  const fieldErrors: Record<string, string> = {};
  if (component) {
    if (component.componentType === 'rating_scale') {
      const min = getConfigNum('min');
      const max = getConfigNum('max');
      if (min !== undefined && max !== undefined && min >= max) {
        fieldErrors.min = 'Min must be less than Max';
        fieldErrors.max = 'Min must be less than Max';
      }
      const step = getConfigNum('step');
      if (step !== undefined && step <= 0) {
        fieldErrors.step = 'Step must be greater than 0';
      }
    }
    if (component.componentType === 'text_input') {
      const maxLen = getConfigNum('maxLength');
      if (maxLen !== undefined && maxLen <= 0) {
        fieldErrors.maxLength = 'Must be greater than 0';
      }
    }
    if (component.componentType === 'file_upload') {
      const mb = getConfigNum('maxSizeMb');
      if (mb !== undefined && mb <= 0) {
        fieldErrors.maxSizeMb = 'Must be greater than 0';
      }
    }
    if (component.componentType === 'quiz_block') {
      const score = getConfigNum('passingScore');
      if (score !== undefined && (score < 0 || score > 100)) {
        fieldErrors.passingScore = 'Must be between 0 and 100';
      }
    }
    if (component.componentType === 'reflection_journal') {
      const words = getConfigNum('minWords');
      if (words !== undefined && words <= 0) {
        fieldErrors.minWords = 'Must be greater than 0';
      }
    }
  }

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
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.panelHeaderLeft}>
          <span className={styles.panelTypeIcon}>
            {COMPONENT_ICONS[component.componentType]}
          </span>
          <div className={styles.panelHeaderMeta}>
            <span className={styles.panelType}>
              {COMPONENT_LABELS[component.componentType]}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.panelClose}
          onClick={onClose}
          title="Close"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className={styles.panelBody}>
        <div className={styles.fieldGroup}>
          <label className={styles.label}>Title</label>
          <input
            ref={titleRef}
            value={component.title}
            onChange={(e) => onUpdate(component.id, { title: e.target.value })}
            className={`${styles.input} ${styles.titleInput}`}
            placeholder="Component title"
          />
        </div>

        <div className={styles.fieldGroup}>
          <div className={styles.fieldGroupHeader}>
            <label className={styles.label}>Description</label>
            <button
              type="button"
              className={styles.autoFillBtn}
              onClick={() => {
                const templates: Record<string, string> = {
                  rich_text: 'A lesson section where students read or watch embedded content. Use this to present core material, explain concepts, or share resources.',
                  video_embed: 'A video lesson. Students watch the embedded video as part of the curriculum.',
                  image_embed: 'An image with a caption. Use this to illustrate concepts or share diagrams.',
                  file_upload: 'Students upload a file here — journal entry, worksheet, or completed exercise.',
                  text_input: 'A short written response question. Students type their answer into a text field.',
                  multiple_choice: 'A multiple-choice question testing understanding or reinforcing key ideas.',
                  quiz_block: 'A graded quiz. Students answer questions to demonstrate mastery of the material.',
                  rating_scale: 'A self-assessment where students rate their understanding on a scale.',
                  reflection_journal: 'A guided journal prompt. Students write a longer reflection on their learning.',
                  poll: 'A quick poll to gather class opinions or check understanding in real time.',
                };
                onUpdate(component.id, {
                  config: { ...component.config, description: templates[component.componentType] ?? '' },
                });
              }}
            >
              Auto-fill
            </button>
          </div>
          <textarea
            value={(component.config?.description as string) ?? ''}
            onChange={(e) =>
              onUpdate(component.id, {
                config: { ...component.config, description: e.target.value },
              })
            }
            className={`${styles.textarea} ${styles.input}`}
            placeholder="What is this component for? Students will see this as context."
            rows={2}
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
            <div className={styles.configHeader}>
              <p className={styles.configHeading}>Configuration</p>
              <div className={styles.presets}>
                {component.componentType === 'multiple_choice' && (
                  <>
                    <button
                      type="button"
                      className={styles.presetBtn}
                      onClick={() => {
                        const presetOptions = JSON.stringify([
                          { id: 't', text: 'True', isCorrect: true },
                          { id: 'f', text: 'False', isCorrect: false },
                        ]);
                        handleFieldChange('options', presetOptions, 'json');
                        handleFieldChange('question', 'True or false?', 'text');
                      }}
                    >
                      True / False
                    </button>
                    <button
                      type="button"
                      className={styles.presetBtn}
                      onClick={() => {
                        const opts = 'ABCD'.split('').map((ch) => ({
                          id: ch.toLowerCase(),
                          text: `Option ${ch}`,
                          isCorrect: false,
                        }));
                        handleFieldChange('options', JSON.stringify(opts), 'json');
                        handleFieldChange('question', '', 'text');
                      }}
                    >
                      4 Options
                    </button>
                  </>
                )}
                {component.componentType === 'rating_scale' && (
                  <button
                    type="button"
                    className={styles.presetBtn}
                    onClick={() => {
                      handleFieldChange('min', '1', 'number');
                      handleFieldChange('max', '5', 'number');
                      handleFieldChange('step', '1', 'number');
                    }}
                  >
                    1–5 Scale
                  </button>
                )}
                {component.componentType === 'quiz_block' && (
                  <button
                    type="button"
                    className={styles.presetBtn}
                    onClick={() => {
                      handleFieldChange('timeLimitMinutes', '10', 'number');
                      handleFieldChange('passingScore', '80', 'number');
                    }}
                  >
                    10 min / 80%
                  </button>
                )}
              </div>
            </div>
            {jsonError && (
              <p className={styles.jsonError}>{jsonError}</p>
            )}
            <div className={styles.fields}>
              {fields.map((field) => (
                <div key={field.key} className={styles.formField}>
                  <span className={styles.formFieldLabel}>{field.label}</span>
                  {component.componentType === 'multiple_choice' && field.key === 'options' ? (
                    <MultipleChoiceEditor
                      value={getConfigValue(field.key)}
                      onChange={(val) => handleFieldChange(field.key, val, 'json')}
                    />
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={getConfigValue(field.key)}
                      onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                      placeholder={field.placeholder}
                      rows={3}
                      className={styles.textarea}
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
                      className={`${styles.input} ${fieldErrors[field.key] ? styles.inputError : ''}`}
                    />
                  )}
                  {fieldErrors[field.key] && (
                    <p className={styles.fieldError}>{fieldErrors[field.key]}</p>
                  )}
                </div>
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
