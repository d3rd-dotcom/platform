'use client';

import Image from 'next/image';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.content}>
        <div className={styles.artworkWrap}>
          <Image
            src="/images/daemoncirclet.webp"
            alt="Daemon Circlet"
            width={1200}
            height={1200}
            className={styles.artwork}
            priority
          />
        </div>
      </main>
    </div>
  );
}
