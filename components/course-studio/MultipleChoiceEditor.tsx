'use client';

import { Plus, Trash } from '@phosphor-icons/react';
import styles from './MultipleChoiceEditor.module.css';

interface Option {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface MultipleChoiceConfig {
  question?: string;
  options?: Option[];
  selectMultiple?: boolean;
}

export default function MultipleChoiceEditor({
  config,
  onUpdate,
}: {
  config: MultipleChoiceConfig;
  onUpdate: (config: Record<string, unknown>) => void;
}) {
  const question = config.question ?? '';
  const options = config.options ?? [];
  const selectMultiple = config.selectMultiple ?? false;

  const patch = (next: Partial<MultipleChoiceConfig>) => {
    onUpdate({ ...config, ...next });
  };

  return (
    <div className={styles.editor}>
      <input
        type="text"
        className={styles.questionInput}
        value={question}
        onChange={(e) => patch({ question: e.target.value })}
        placeholder="Enter your question..."
      />

      <div className={styles.optionsList}>
        {options.map((opt) => (
          <div key={opt.id} className={styles.optionRow}>
            <label className={styles.radioWrapper}>
              <input
                type={selectMultiple ? 'checkbox' : 'radio'}
                name="mc-correct"
                checked={opt.isCorrect}
                onChange={() => {
                  patch({
                    options: selectMultiple
                      ? options.map((o) => (o.id === opt.id ? { ...o, isCorrect: !o.isCorrect } : o))
                      : options.map((o) => ({ ...o, isCorrect: o.id === opt.id ? !o.isCorrect : false })),
                  });
                }}
                className={styles.correctToggle}
              />
              <span className={styles.radioVisual} />
            </label>
            <input
              type="text"
              className={styles.optionInput}
              value={opt.text}
              onChange={(e) => {
                patch({
                  options: options.map((o) => (o.id === opt.id ? { ...o, text: e.target.value } : o)),
                });
              }}
              placeholder="Option text..."
            />
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => patch({ options: options.filter((o) => o.id !== opt.id) })}
              title="Remove option"
            >
              <Trash size={13} weight="bold" />
            </button>
          </div>
        ))}
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.addBtn}
          onClick={() =>
            patch({
              options: [
                ...options,
                { id: `opt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', isCorrect: false },
              ],
            })
          }
        >
          <Plus size={14} weight="bold" /> Add option
        </button>

        <label className={styles.toggleLabel}>
          <input
            type="checkbox"
            checked={selectMultiple}
            onChange={(e) => patch({ selectMultiple: e.target.checked })}
          />
          Allow multiple selections
        </label>
      </div>
    </div>
  );
}
