'use client';

import { useState, type ReactNode } from 'react';
import { useSound } from '@/hooks/useSound';

import styles from './FolderCardWrapper.module.css';

// Folder-tab silhouette: rounded top-left, flat top, rounded top-right, then a
// straight slant down to the bottom-right where it meets the tray. The top and
// left stay inset for their centred stroke; the slant ends on the right grid
// boundary so it meets the tray's border without an overlap seam.
const TAB_FILL_PATH = 'M1 52 L1 16 Q1 1 16 1 L150 1 Q166 1 172 13 L210 52 Z';
// Same outline minus the bottom edge, so the border wraps the top and slant
// but leaves the base open against the tray.
const TAB_STROKE_PATH = 'M1 52 L1 16 Q1 1 16 1 L150 1 Q166 1 172 13 L210 52';

function TabShape() {
  return (
    <svg className={styles.tabShape} viewBox="0 0 210 52" preserveAspectRatio="none" aria-hidden="true">
      <path d={TAB_FILL_PATH} className={styles.tabFill} />
      <path d={TAB_STROKE_PATH} className={styles.tabStroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface FolderTab {
  label: string;
  content?: ReactNode;
}

interface FolderCardWrapperProps {
  tabs: FolderTab[];
}

export default function FolderCardWrapper({ tabs }: FolderCardWrapperProps) {
  const [active, setActive] = useState(0);
  const { play } = useSound();
  const activeTab = tabs[active] ?? tabs[0];

  return (
    <section className={styles.shell} data-active-tab={active} aria-label="Learning folders">
      <div className={styles.tabs} role="tablist" aria-label="Learning categories">
        {tabs.map((tab, i) => {
          const isActive = i === active;
          return (
            <button
              key={tab.label}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
              // Active tab sits in front; the rest keep left-over-right slant order.
              style={{ zIndex: isActive ? tabs.length + 1 : tabs.length - i }}
              onClick={() => { play('click'); setActive(i); }}
            >
              <TabShape />
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className={styles.trayTopBorder} aria-hidden="true" />
      <div className={styles.wrapper}>
        <div className={styles.content}>
          {activeTab?.content ?? (
            <div className={styles.emptyState}>
              <p className={styles.emptyPanel}>{activeTab?.label} are coming soon.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.emptyStateGif} src="/images/walking.gif" alt="Blue walking" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
