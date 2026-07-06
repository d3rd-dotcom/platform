'use client';

import React from 'react';
import styles from './LandingPage.module.css';
import GlitchRevealText from './GlitchRevealText';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { LandingScene } from './LandingScene';
import { HeroSting } from './scroll/HeroSting';

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <LandingScene />
        <HeroSting />
        <div className={styles.heroContent} data-hero-parallax>
          <p className={styles.heroTextBadge}>A Gameworld For Structured Growth</p>
          <GlitchRevealText
            as="h1"
            className={styles.heroHeadline}
            lines={[
              { text: 'Mental Wealth' },
              { text: 'Academy', accent: true },
            ]}
            accentClassName={styles.heroHeadlineAccent}
            staggerDelay={50}
            duration={1000}
            startDelay={200}
          />
          <div className={styles.heroLine} />
          <p className={styles.heroSubtext}>
            Study behavioral psychology like a game. Level up through courses and quests. Blue reviews your work and pays real rewards straight to your wallet.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
          </div>
        </div>

      </div>
    </>
  );
};

export default HeroSection;
