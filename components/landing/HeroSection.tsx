'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import LandingEnterAsAgentButton from './LandingEnterAsAgentButton';
import CompanyLogos from './CompanyLogos';
import OrbitalDiagram from './OrbitalDiagram';

export const EcosystemSection: React.FC = () => (
  <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
    <div className={styles.ecosystemInner}>
      <div className={styles.ecosystemLayout}>
        <div className={styles.ecosystemCopy}>
          <p className={styles.ecosystemKicker}>PhD-designed curriculum</p>
          <h2 className={styles.ecosystemHeadline}>
            How Digital Education<br />
            <span className={styles.ecosystemHeadlineAccent}>Should Have Been.</span>
          </h2>
          <p className={styles.ecosystemSubtext}>
            A gamified experience built to feel as engaging as a video game — optimized for real learning and the generation that grew up in it. Every step is a quest full of meaning.
          </p>
          <ul className={styles.ecosystemFeatureList}>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#5168FF' }} />
              Build mental wealth with daily notes and weekly quests.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#8B6BFF' }} />
              Curriculums backed by neuroscientists, psychologists, & academia-grade research.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#3CC9B4' }} />
              Leaderboard for those who love a great challenge.
            </li>
          </ul>
          <LandingEnterAcademyButton />
        </div>
        <div className={styles.ecosystemDiagramWrap}>
          <OrbitalDiagram />
        </div>
      </div>
    </div>
  </section>
);

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <div className={styles.heroBeam} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>No more endless scrolling.</p>
          <h1 className={styles.heroHeadline}>
            <span>Unlock Your </span>
            <span className={styles.heroHeadlineAccent}>New Horizon</span>
          </h1>
          <p className={styles.heroSubtext}>
            Turn mental wealth goals into trackable, goal-driven & engaging quests designed by psychologists to help you level-up.
          </p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton />
            <LandingEnterAsAgentButton />
          </div>
        </div>
        <div className={styles.heroAppShotFrame} aria-hidden="true">
          <Image
            src="/images/hero-app-shot.webp"
            alt=""
            width={1600}
            height={900}
            className={styles.heroAppShotImage}
            priority
          />
        </div>
      </div>

      <CompanyLogos />
    </>
  );
};

export default HeroSection;
