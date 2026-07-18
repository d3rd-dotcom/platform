'use client';

import Image from 'next/image';
import styles from './MagazineSection.module.css';

export const MagazineSection: React.FC = () => {
  return (
    <section id="vision" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.textColumn}>
          <h2 className={styles.heading}>Read the Lore</h2>
          <p className={styles.description}>
            Each issue explores the Ethereal Horizon and the story behind Blue,
            then shares mental wealth tips for daily life.
          </p>
          <a
            href="https://zora.co/coin/base:0xbfa7ba543ec90ccd9c30de7a76a5a23e1f18f92c?referrer=0x8c0704cde03a42f1a9362e574addb156bb7e8c95"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.cta}
          >
            Collect on Zora
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
