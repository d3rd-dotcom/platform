'use client';

import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <div className={styles.player}>
          <button type="button" className={styles.playBtn} aria-label="Play video">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.14v14l11-7-11-7z" />
            </svg>
          </button>
        </div>
      </main>
    </div>
  );
}
