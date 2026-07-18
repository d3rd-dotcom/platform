'use client';

import Image from 'next/image';
import React from 'react';
import CtaButton from '@/components/shared/CtaButton';
import styles from './HowItWorksSection.module.css';

const introCopy =
  'MWA started as a small cohort of “vibe-learners”: developers, psychologists, and designers. One IRB-study idea for a new social model for mental wealth. Members learn at a self-pace through journaling, knowledge nodes, and emerging mental wellness hacks. We support you as you level-up your education online and IRL.';

export const HowItWorksSection: React.FC = () => (
  <section id="how-it-works" className={styles.section} aria-label="How it works">
    <div className={styles.container}>
      <div className={styles.copy}>
        <h2 className={styles.heading}>
          Your education deserves{' '}
          <span className={styles.headingHighlight}>new solutions</span>
        </h2>
        <p className={styles.lead}>{introCopy}</p>
        <div className={styles.actions}>
          <CtaButton href="/home" size="lg">Explore the Academy</CtaButton>
          <CtaButton href="#membership" variant="secondary" size="lg">View memberships</CtaButton>
        </div>
      </div>

      <Image
        className={styles.image}
        src="/landing/blue-learning-companion.png"
        alt="Blue, the Mental Wealth Academy learning companion"
        width={1536}
        height={1024}
        sizes="(max-width: 900px) 100vw, 50vw"
      />
    </div>
  </section>
);

export default HowItWorksSection;
