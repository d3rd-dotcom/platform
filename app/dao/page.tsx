'use client';

import SideNavigation from '@/components/side-navigation/SideNavigation';
import HomeBento from '@/components/home-bento/HomeBento';
import WelcomePremiumGate from '@/components/welcome-premium/WelcomePremiumGate';
import styles from './page.module.css';

export default function DaoPage() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <HomeBento />
      </main>
      <WelcomePremiumGate />
    </div>
  );
}
