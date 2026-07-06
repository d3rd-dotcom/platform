'use client';

import Link from 'next/link';
import Image from 'next/image';
import CyberpunkDataViz from '@/components/cyberpunk-data-viz/CyberpunkDataViz';
import { Footer } from '@/components/footer/Footer';
import styles from './not-found.module.css';

export default function NotFound() {
  return (
    <div className={styles.page}>
      <div className={styles.bgViz}>
        <CyberpunkDataViz />
      </div>
      <div className={styles.main}>
        <div className={styles.rightCol}>
          <div className={styles.content}>
            <h3 className={styles.heading}>We Couldn&apos;t Find The Page You&apos;re Looking For*</h3>
            <p className={styles.paragraph}>
              Sorry! The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
          <Link href="/courses" className={styles.cta}>
            Return to Safety
          </Link>
        </div>
      </div>
      <div className={styles.imageWrapper}>
        <Image
          src="/BlueTriModel.png"
          alt="404 Not Found"
          width={400}
          height={400}
          className={styles.image}
          priority
          unoptimized
        />
      </div>
      <Footer />
    </div>
  );
}
