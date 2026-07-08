'use client';

import React from 'react';
import styles from './LandingPage.module.css';
import GlitchRevealText from './GlitchRevealText';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { LandingScene } from './LandingScene';

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <LandingScene />
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>An educational gameworld on Base</p>
          <GlitchRevealText
            as="h1"
            className={styles.heroHeadline}
            lines={[
              { text: 'A Micro-University For' },
              { text: 'Intellectual Refreshment', accent: true },
            ]}
            accentClassName={styles.heroHeadlineAccent}
            staggerDelay={50}
            duration={1000}
            startDelay={200}
          />
          <div className={styles.heroLine} />
          <p className={styles.heroSubtext}>
            Learn anything and earn while you do it. No lectures, no gurus. It&apos;s all led by a superpowered quantum alien named Blue.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
          </div>
        </div>

      </div>
    </>
  );
};

export default HeroSection;
