import type { ReactNode } from 'react';

import styles from './FolderCardWrapper.module.css';

interface FolderCardWrapperProps {
  children: ReactNode;
}

export default function FolderCardWrapper({ children }: FolderCardWrapperProps) {
  return (
    <section className={styles.shell} aria-label="Learning folders">
      <div className={styles.tabs} aria-label="Learning categories">
        <span className={`${styles.tab} ${styles.tabActive}`}><span className={styles.tabLabel}>My Courses</span></span>
        <span className={styles.tab}><span className={styles.tabLabel}>Lectures</span></span>
        <span className={styles.tab}><span className={styles.tabLabel}>Workshops</span></span>
      </div>
      <div className={styles.trayTopBorder} aria-hidden="true" />
      <div className={styles.wrapper}>
        <div className={styles.content}>{children}</div>
      </div>
    </section>
  );
}
