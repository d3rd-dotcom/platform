import type { ReactNode } from 'react';

import styles from './FolderCardWrapper.module.css';

// Folder-tab silhouette: rounded top-left, flat top, rounded top-right, then a
// straight slant down to the bottom-right where it meets the tray. Inset 1px on
// the top/left/right so the centred 2px stroke sits fully inside the box, lining
// up with the tray's border-box border below (bottom stays at 52 to meet flush).
const TAB_FILL_PATH = 'M1 52 L1 16 Q1 1 16 1 L150 1 Q166 1 172 13 L209 52 Z';
// Same outline minus the bottom edge, so the border wraps the top and slant
// but leaves the base open against the tray.
const TAB_STROKE_PATH = 'M1 52 L1 16 Q1 1 16 1 L150 1 Q166 1 172 13 L209 52';

function TabShape() {
  return (
    <svg className={styles.tabShape} viewBox="0 0 210 52" preserveAspectRatio="none" aria-hidden="true">
      <path d={TAB_FILL_PATH} className={styles.tabFill} />
      <path d={TAB_STROKE_PATH} className={styles.tabStroke} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

interface FolderCardWrapperProps {
  children: ReactNode;
}

export default function FolderCardWrapper({ children }: FolderCardWrapperProps) {
  return (
    <section className={styles.shell} aria-label="Learning folders">
      <div className={styles.tabs} aria-label="Learning categories">
        <span className={`${styles.tab} ${styles.tabActive}`}>
          <TabShape />
          <span className={styles.tabLabel}>My Courses</span>
        </span>
        <span className={styles.tab}>
          <TabShape />
          <span className={styles.tabLabel}>Lectures</span>
        </span>
        <span className={styles.tab}>
          <TabShape />
          <span className={styles.tabLabel}>Workshops</span>
        </span>
      </div>
      <div className={styles.trayTopBorder} aria-hidden="true" />
      <div className={styles.wrapper}>
        <div className={styles.content}>{children}</div>
      </div>
    </section>
  );
}
