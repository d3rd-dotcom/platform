'use client';

import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './LegacyMissionRenderer.module.css';

interface LegacyMissionRendererProps {
  component: CourseComponentRecord;
  onUpdate?: (config: Record<string, unknown>) => void;
}

export default function LegacyMissionRenderer({ component, onUpdate }: LegacyMissionRendererProps) {
  const config = component.config ?? {};
  const legacyType = config.legacyType as string;

  switch (legacyType) {
    case 'text':
      return <TextRenderer config={config} onUpdate={onUpdate} />;
    case 'numbered-list':
      return <NumberedListRenderer config={config} onUpdate={onUpdate} />;
    case 'lists':
      return <ListsRenderer config={config} onUpdate={onUpdate} />;
    case 'lives':
      return <ListsRenderer config={config} onUpdate={onUpdate} />;
    case 'checklist':
      return <ChecklistRenderer config={config} onUpdate={onUpdate} />;
    case 'enjoy-list':
      return <EnjoyListRenderer config={config} onUpdate={onUpdate} />;
    case 'affirmations':
      return <AffirmationsRenderer config={config} onUpdate={onUpdate} />;
    case 'life-pie':
      return <LifePieRenderer config={config} onUpdate={onUpdate} />;
    default:
      return <div className={styles.fallback}>{component.title}</div>;
  }
}

/* ── Helpers ── */

function isBuilder(onUpdate: ((c: Record<string, unknown>) => void) | undefined): onUpdate is (c: Record<string, unknown>) => void {
  return !!onUpdate;
}

/* ── Free Write ── */

function TextRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const text = (config.text as string) ?? '';
  const building = isBuilder(onUpdate);
  return (
    <textarea
      className={styles.textarea}
      value={building ? text : ''}
      placeholder={building ? 'Write your reflection...' : (text || 'Write your reflection...')}
      onChange={(e) => onUpdate?.({ ...config, text: e.target.value })}
      rows={4}
    />
  );
}

/* ── Numbered List ── */

function NumberedListRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const labels = (config.labels as string[]) ?? [];
  const building = isBuilder(onUpdate);
  return (
    <div className={styles.listInputs}>
      {labels.map((label, i) => (
        <div key={i} className={styles.listItem}>
          <label className={styles.listLabel}>{label}</label>
          {building ? (
            <input
              type="text"
              className={styles.input}
              placeholder={`Enter prompt ${i + 1}...`}
              value={label}
              onChange={(e) => { const n = [...labels]; n[i] = e.target.value; onUpdate({ ...config, labels: n }); }}
            />
          ) : (
            <input
              type="text"
              className={styles.input}
              placeholder={`Write your answer for ${label.toLowerCase()}...`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

/* ── Lists (formerly Lives) ── */

function ListsRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const listLabels = (config.listLabels as string[]) ?? [];
  const building = isBuilder(onUpdate);
  const actionText = (config.actionText as string) ?? '';

  return (
    <div className={styles.livesContainer}>
      {listLabels.map((label, i) => (
        <div key={i} className={styles.lifeItem}>
          <span className={styles.lifeNumber}>{i + 1}</span>
          {building ? (
            <input
              type="text"
              className={styles.lifeInput}
              placeholder="Enter prompt..."
              value={label}
              onChange={(e) => { const n = [...listLabels]; n[i] = e.target.value; onUpdate?.({ ...config, listLabels: n }); }}
            />
          ) : (
            <input
              type="text"
              className={styles.lifeInput}
              placeholder={label}
            />
          )}
        </div>
      ))}
      <div className={styles.lifeAction}>
        <label className={styles.listLabel}>Reflection prompt:</label>
        <textarea
          className={styles.textarea}
          value={building ? actionText : ''}
          placeholder={building ? "What will you try this week?" : (actionText || "What will you try this week?")}
          onChange={(e) => onUpdate?.({ ...config, actionText: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}

/* ── Checklist ── */

function ChecklistRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const checkItems = (config.checkItems as string[]) ?? [''];
  const building = isBuilder(onUpdate);
  return (
    <div className={styles.checklistContainer}>
      {checkItems.map((item, i) => (
        <label key={i} className={styles.checklistItem}>
          <input type="checkbox" className={styles.checkbox} />
          {building ? (
            <input
              className={styles.checklistText}
              value={item}
              onChange={(e) => { const n = [...checkItems]; n[i] = e.target.value; onUpdate?.({ ...config, checkItems: n }); }}
              placeholder="Checklist item..."
            />
          ) : (
            <span className={styles.checklistText}>{item}</span>
          )}
        </label>
      ))}
    </div>
  );
}

/* ── Enjoy List ── */

function EnjoyListRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const enjoyItems = (config.enjoyItems as Array<{ thing: string; lastTime: string }>) ?? [];
  const count = (config.count as number) ?? 1;
  const building = isBuilder(onUpdate);

  const setItems = (items: Array<{ thing: string; lastTime: string }>) => {
    onUpdate?.({ ...config, enjoyItems: items, count: items.length });
  };

  // Ensure enjoyItems length matches count
  const safeItems = Array.from({ length: count }).map((_, i) => enjoyItems[i] ?? { thing: '', lastTime: '' });

  const updateItem = (i: number, field: 'thing' | 'lastTime', val: string) => {
    const n = [...safeItems]; n[i] = { ...n[i], [field]: val }; setItems(n);
  };

  const addItem = () => setItems([...safeItems, { thing: '', lastTime: '' }]);
  const removeItem = (i: number) => setItems(safeItems.filter((_, idx) => idx !== i));

  return (
    <div className={styles.enjoyListContainer}>
      <div className={styles.enjoyListHeader}>
        <span />
        <span>Thing I Enjoy</span>
        <span>Last Time I Did It</span>
      </div>
      {safeItems.map((item, i) => (
        <div key={i} className={`${styles.enjoyListRow} ${building ? styles.enjoyListRowBuilder : ''}`}>
          <span className={styles.enjoyListNumber}>{i + 1}</span>
          {building ? (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder="Something I enjoy..."
                value={item.thing}
                onChange={(e) => updateItem(i, 'thing', e.target.value)}
              />
              <input
                type="text"
                className={styles.dateInput}
                placeholder="Date"
                value={item.lastTime}
                onChange={(e) => updateItem(i, 'lastTime', e.target.value)}
              />
              <button type="button" className={styles.removeItemBtn} onClick={() => removeItem(i)} title="Remove">✕</button>
            </>
          ) : (
            <>
              <input
                type="text"
                className={styles.input}
                placeholder={item.thing || 'Something I enjoy...'}
              />
              <input
                type="text"
                className={styles.dateInput}
                placeholder={item.lastTime || 'Date'}
              />
            </>
          )}
        </div>
      ))}
      {building && (
        <button type="button" className={styles.addBtn} onClick={addItem}>+ Add row</button>
      )}
    </div>
  );
}

/* ── Gratitude (formerly Affirmations) ── */

function AffirmationsRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const affirmValues = (config.affirmValues as string[]) ?? [];
  const count = (config.count as number) ?? 1;
  const building = isBuilder(onUpdate);

  const setCount = (n: number) => {
    const newValues = [...affirmValues];
    if (n > newValues.length) {
      while (newValues.length < n) newValues.push('');
    } else {
      newValues.splice(n);
    }
    onUpdate?.({ ...config, count: n, affirmValues: newValues });
  };

  const removeEntry = (i: number) => {
    const newValues = affirmValues.filter((_, idx) => idx !== i);
    onUpdate?.({ ...config, count: newValues.length, affirmValues: newValues });
  };

  return (
    <div className={styles.affirmationsContainer}>
      <div className={styles.listInputs}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.listItem}>
            <div className={styles.entryHeader}>
              <label className={styles.listLabel}>Gratitude Entry {i + 1}</label>
              {building && count > 1 && (
                <button type="button" className={styles.removeItemBtn} onClick={() => removeEntry(i)} title="Remove">✕</button>
              )}
            </div>
            {building ? (
              <input
                type="text"
                className={styles.affirmationInputGreen}
                placeholder="I am grateful for..."
                value={affirmValues[i] ?? ''}
                onChange={(e) => { const n = [...affirmValues]; n[i] = e.target.value; onUpdate?.({ ...config, affirmValues: n }); }}
              />
            ) : (
              <input
                type="text"
                className={styles.affirmationInputGreen}
                placeholder={affirmValues[i] || 'I am grateful for...'}
              />
            )}
          </div>
        ))}
      </div>
      {building && (
        <button type="button" className={styles.addBtn} onClick={() => setCount(count + 1)}>+ Add entry</button>
      )}
    </div>
  );
}

/* ── Sliders (formerly Life Pie) ── */

function LifePieRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const labels = (config.labels as string[]) ?? ['Values'];
  const sliderValues = (config.sliderValues as number[]) ?? [];
  const max = (config.max as number) ?? 10;
  const reflectionText = (config.reflectionText as string) ?? '';
  const building = isBuilder(onUpdate);

  const areas = labels.map((l, i) => ({ key: `area-${i}`, label: l, value: sliderValues[i] ?? Math.floor(max / 2) }));

  const updateLabel = (i: number, val: string) => {
    const n = [...labels]; n[i] = val; onUpdate?.({ ...config, labels: n });
  };
  const addSlider = () => {
    onUpdate?.({ ...config, labels: [...labels, ''], sliderValues: [...sliderValues, Math.floor(max / 2)] });
  };
  const removeSlider = (i: number) => {
    const newLabels = labels.filter((_, idx) => idx !== i);
    const newValues = sliderValues.filter((_, idx) => idx !== i);
    onUpdate?.({ ...config, labels: newLabels, sliderValues: newValues });
  };

  return (
    <div className={styles.lifePieContainer}>
      <p className={styles.lifePieInstructions}>Rate each area from 0 to {max}:</p>
      <div className={styles.lifePieSliders}>
        {areas.map((area, i) => (
          <div key={area.key} className={styles.lifePieSlider}>
            <div className={styles.sliderHeader}>
              {building ? (
                <input
                  type="text"
                  className={styles.sliderLabelInput}
                  value={area.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  placeholder="Area name..."
                />
              ) : (
                <span className={styles.lifePieLabel}>{area.label}</span>
              )}
              <span className={styles.lifePieValue}>{sliderValues[i] ?? area.value}/{max}</span>
              {building && labels.length > 1 && (
                <button type="button" className={styles.removeSliderBtn} onClick={() => removeSlider(i)} title="Remove">✕</button>
              )}
            </div>
            <input
              type="range"
              min={0}
              max={max}
              value={sliderValues[i] ?? area.value}
              onChange={(e) => { const n = [...sliderValues]; n[i] = Number(e.target.value); onUpdate?.({ ...config, sliderValues: n }); }}
              className={styles.slider}
            />
          </div>
        ))}
      </div>
      {building && (
        <button type="button" className={styles.addBtn} onClick={addSlider}>+ Add slider</button>
      )}
      <div className={styles.listItem}>
        <label className={styles.listLabel}>Reflection prompt:</label>
        <textarea
          className={styles.textarea}
          value={building ? reflectionText : ''}
          placeholder={building ? "Which areas need attention?" : (reflectionText || "Which areas need attention?")}
          onChange={(e) => onUpdate?.({ ...config, reflectionText: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}
