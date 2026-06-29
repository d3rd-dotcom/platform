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
    case 'lives':
      return <LivesRenderer config={config} onUpdate={onUpdate} />;
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

function TextRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const text = (config.text as string) ?? '';
  return (
    <textarea
      className={styles.textarea}
      value={text}
      onChange={(e) => onUpdate?.({ ...config, text: e.target.value })}
      placeholder="Write your reflection..."
      rows={4}
    />
  );
}

function NumberedListRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const labels = (config.labels as string[]) ?? [];
  const values = (config.values as string[]) ?? [];
  return (
    <div className={styles.listInputs}>
      {labels.map((label, i) => (
        <div key={i} className={styles.listItem}>
          <label className={styles.listLabel}>{label}</label>
          <input
            type="text"
            className={styles.input}
            placeholder={`Enter ${label.toLowerCase()}...`}
            value={values[i] ?? ''}
            onChange={(e) => { const n = [...values]; n[i] = e.target.value; onUpdate?.({ ...config, values: n }); }}
          />
        </div>
      ))}
    </div>
  );
}

function LivesRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const listLabels = (config.listLabels as string[]) ?? [];
  const lifeValues = (config.lifeValues as string[]) ?? [];
  const actionText = (config.actionText as string) ?? '';
  return (
    <div className={styles.livesContainer}>
      {listLabels.map((label, i) => (
        <div key={i} className={styles.lifeItem}>
          <span className={styles.lifeNumber}>{i + 1}</span>
          <input
            type="text"
            className={styles.lifeInput}
            placeholder="Describe this life..."
            value={lifeValues[i] ?? ''}
            onChange={(e) => { const n = [...lifeValues]; n[i] = e.target.value; onUpdate?.({ ...config, lifeValues: n }); }}
          />
        </div>
      ))}
      <div className={styles.lifeAction}>
        <label className={styles.listLabel}>This week I will try:</label>
        <textarea
          className={styles.textarea}
          value={actionText}
          onChange={(e) => onUpdate?.({ ...config, actionText: e.target.value })}
          placeholder="Pick one life and describe what you'll do to explore it this week..."
          rows={3}
        />
      </div>
    </div>
  );
}

function ChecklistRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const checkItems = (config.checkItems as string[]) ?? [];
  return (
    <div className={styles.checklistContainer}>
      {checkItems.map((item, i) => (
        <label key={i} className={styles.checklistItem}>
          <input type="checkbox" className={styles.checkbox} />
          <input
            className={styles.checklistText}
            value={item}
            onChange={(e) => { const n = [...checkItems]; n[i] = e.target.value; onUpdate?.({ ...config, checkItems: n }); }}
          />
        </label>
      ))}
    </div>
  );
}

function EnjoyListRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const enjoyItems = (config.enjoyItems as Array<{ thing: string; lastTime: string }>) ?? [];
  const count = (config.count as number) ?? 20;
  return (
    <div className={styles.enjoyListContainer}>
      <div className={styles.enjoyListHeader}>
        <span />
        <span>Thing I Enjoy</span>
        <span>Last Time I Did It</span>
      </div>
      {Array.from({ length: Math.min(count, 20) }).map((_, i) => (
        <div key={i} className={styles.enjoyListRow}>
          <span className={styles.enjoyListNumber}>{i + 1}</span>
          <input
            type="text"
            className={styles.input}
            placeholder="Something I enjoy..."
            value={enjoyItems[i]?.thing ?? ''}
            onChange={(e) => { const n = [...enjoyItems]; n[i] = { ...n[i], thing: e.target.value, lastTime: n[i]?.lastTime ?? '' }; onUpdate?.({ ...config, enjoyItems: n }); }}
          />
          <input
            type="text"
            className={styles.dateInput}
            placeholder="Date"
            value={enjoyItems[i]?.lastTime ?? ''}
            onChange={(e) => { const n = [...enjoyItems]; n[i] = { ...n[i], lastTime: e.target.value, thing: n[i]?.thing ?? '' }; onUpdate?.({ ...config, enjoyItems: n }); }}
          />
        </div>
      ))}
    </div>
  );
}

function AffirmationsRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const affirmValues = (config.affirmValues as string[]) ?? [];
  const count = (config.count as number) ?? 3;
  return (
    <div className={styles.affirmationsContainer}>
      <div className={styles.listInputs}>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={styles.listItem}>
            <label className={styles.listLabel}>Chosen Affirmation {i + 1}</label>
            <input
              type="text"
              className={styles.affirmationInputGreen}
              placeholder="I am creative and my ideas have value..."
              value={affirmValues[i] ?? ''}
              onChange={(e) => { const n = [...affirmValues]; n[i] = e.target.value; onUpdate?.({ ...config, affirmValues: n }); }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function LifePieRenderer({ config, onUpdate }: { config: Record<string, unknown>; onUpdate?: (c: Record<string, unknown>) => void }) {
  const labels = (config.labels as string[]) ?? [];
  const sliderValues = (config.sliderValues as number[]) ?? [];
  const max = (config.max as number) ?? 10;
  const reflectionText = (config.reflectionText as string) ?? '';

  const areas = labels.length > 0
    ? labels.map((l, i) => ({ key: `area-${i}`, label: l, value: sliderValues[i] ?? Math.floor(max / 2) }))
    : [
        { key: 'spirituality', label: 'Values', value: sliderValues[0] ?? Math.floor(max / 2) },
        { key: 'exercise', label: 'Exercise', value: sliderValues[1] ?? Math.floor(max / 2) },
        { key: 'play', label: 'Play', value: sliderValues[2] ?? Math.floor(max / 2) },
        { key: 'work', label: 'Work', value: sliderValues[3] ?? Math.floor(max / 2) },
        { key: 'friends', label: 'Friends', value: sliderValues[4] ?? Math.floor(max / 2) },
        { key: 'romance', label: 'Romance/Adventure', value: sliderValues[5] ?? Math.floor(max / 2) },
      ];

  return (
    <div className={styles.lifePieContainer}>
      <p className={styles.lifePieInstructions}>Rate each area from 0 to {max}:</p>
      <div className={styles.lifePieSliders}>
        {areas.map((area, i) => (
          <div key={area.key} className={styles.lifePieSlider}>
            <label className={styles.lifePieLabel}>
              <span>{area.label}</span>
              <span className={styles.lifePieValue}>{sliderValues[i] ?? area.value}/{max}</span>
            </label>
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
      <div className={styles.listItem}>
        <label className={styles.listLabel}>Reflection: Which areas need attention?</label>
        <textarea
          className={styles.textarea}
          value={reflectionText}
          onChange={(e) => onUpdate?.({ ...config, reflectionText: e.target.value })}
          placeholder="What small actions could nurture your impoverished areas?"
          rows={3}
        />
      </div>
    </div>
  );
}
