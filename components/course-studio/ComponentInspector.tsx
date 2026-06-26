'use client';

import { useState } from 'react';
import type { CourseComponentRecord, ComponentType } from '@/lib/vip-course-db';

interface ComponentInspectorProps {
  component: CourseComponentRecord | null;
  onUpdate: (compId: string, updates: Partial<CourseComponentRecord>) => void;
  onDelete: (compId: string) => void;
}

const CONFIG_FIELDS: Record<ComponentType, Array<{
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'json';
  options?: { value: string; label: string }[];
  placeholder?: string;
}>> = {
  rich_text: [
    { key: 'content', label: 'Content', type: 'textarea', placeholder: 'Markdown or HTML content...' },
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

export default function ComponentInspector({ component, onUpdate, onDelete }: ComponentInspectorProps) {
  const [localConfig, setLocalConfig] = useState<Record<string, string>>({});
  const [jsonError, setJsonError] = useState<string | null>(null);

  if (!component) {
    return (
      <div className="text-neutral-400 text-sm italic p-4 text-center">
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
    <div>
      <div className="mb-4">
        <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">Title</label>
        <input
          value={component.title}
          onChange={(e) => onUpdate(component.id, { title: e.target.value })}
          className="w-full p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
          placeholder="Component title"
        />
      </div>

      <div className="mb-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={component.required}
            onChange={(e) => onUpdate(component.id, { required: e.target.checked })}
            className="rounded"
          />
          Required
        </label>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Config</p>
        {jsonError && (
          <p className="text-xs text-red-500">{jsonError}</p>
        )}
        {fields.map((field) => (
          <label key={field.key} className="block text-sm">
            <span className="text-neutral-600 dark:text-neutral-400 text-xs">{field.label}</span>
            {field.type === 'textarea' ? (
              <textarea
                value={getConfigValue(field.key)}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                placeholder={field.placeholder}
                rows={4}
                className="w-full mt-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
              />
            ) : field.type === 'json' ? (
              <textarea
                value={getConfigValue(field.key)}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                placeholder={field.placeholder}
                rows={4}
                className="w-full mt-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 font-mono"
              />
            ) : field.type === 'select' ? (
              <select
                value={String((component.config as Record<string, unknown>)[field.key] ?? '')}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                className="w-full mt-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
              >
                <option value="">--</option>
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type}
                value={getConfigValue(field.key)}
                onChange={(e) => handleFieldChange(field.key, e.target.value, field.type)}
                placeholder={field.placeholder}
                className="w-full mt-1 p-2 text-sm rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800"
              />
            )}
          </label>
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => onDelete(component.id)}
          className="w-full px-3 py-2 text-sm rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          Delete component
        </button>
      </div>
    </div>
  );
}
