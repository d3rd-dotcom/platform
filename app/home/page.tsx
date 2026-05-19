'use client';

import SideNavigation from '@/components/side-navigation/SideNavigation';
import HomeBento from '@/components/home-bento/HomeBento';
import FeatureTour from '@/components/feature-tour/FeatureTour';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <HomeBento />
      </main>
      <FeatureTour />
    </div>
  );
}
