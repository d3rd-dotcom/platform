'use client';

import Image from 'next/image';
import styles from './MagazineSection.module.css';

export const MagazineSection: React.FC = () => {
  return (
    <section className={styles.section}>
      <div className={styles.container}>
        <div className={styles.textColumn}>
          <p className={styles.eyebrow}>Mental Wealth Magazine</p>
          <h2 className={styles.heading}>Read the Vision</h2>
          <p className={styles.description}>
            Every issue of <em>Mental Wealth</em> explores the frontier where
            cyberculture, consciousness, and capital converge. From
            psychedelic science to decentralised governance — if it rewires
            how we think, it lives here.
          </p>
          <a
            href="/magazines"
            className={styles.cta}
          >
            Browse Issues
          </a>
        </div>
        <div className={styles.imageColumn}>
          <div className={`${styles.magazineCard} ${styles.magazineRear}`}>
            <Image
              src="/magazines/2082.png"
              alt="Mental Wealth Magazine — Issue 2082"
              width={300}
              height={400}
              className={styles.magazineImage}
            />
          </div>
          <div className={`${styles.magazineCard} ${styles.magazineFront}`}>
            <Image
              src="/magazines/september-2031.png"
              alt="Mental Wealth Magazine — September 2031"
              width={300}
              height={400}
              className={styles.magazineImage}
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default MagazineSection;
