'use client';

import SideNavigation from '@/components/side-navigation/SideNavigation';
import CyberpunkDataViz from '@/components/cyberpunk-data-viz/CyberpunkDataViz';
import ProfileDashboard from '@/components/home/ProfileDashboard';
import VerifierBadges from '@/components/guides/VerifierBadges';
import VerifierCredentials from '@/components/guides/VerifierCredentials';
import VerifierPanelQueue from '@/components/guides/VerifierPanelQueue';
import styles from './page.module.css';

export default function ProfilePage() {
  return (
    <div className={styles.pageLayout}>
      <div className={styles.bgViz}><CyberpunkDataViz /></div>
      <SideNavigation />
      <main className={styles.page}>
        <section className={styles.shell}>
          <ProfileDashboard />
        </section>
        <section className={styles.shell}>
          <VerifierBadges />
          <VerifierCredentials />
        </section>
        <section className={styles.shell}>
          <VerifierPanelQueue />
        </section>
      </main>
    </div>
  );
}
