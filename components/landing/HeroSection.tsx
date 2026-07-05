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
          <p className={styles.heroTextBadge}>Next-Gen Cohort For Scientists &amp; Agents</p>
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
            A gamified educational gameworld built on behavioral psychology, accompanied by B.L.U.E. Level up through knowledge structured in ascending order — no tutorial hell — and own what you earn on-chain.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
          </div>
        </div>

      </div>
    </>
  );
};

export default HeroSection;
