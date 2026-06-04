'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import LandingEnterAsAgentButton from './LandingEnterAsAgentButton';
import { KeyFiguresSection } from './KeyFiguresSection';
import ProblemMap from './ProblemMap';

export const EcosystemSection: React.FC = () => (
  <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
    <div className={styles.ecosystemInner}>
      <div className={styles.ecosystemLayout}>
        <div className={styles.ecosystemCopy}>
          <p className={styles.ecosystemKicker}>The access problem</p>
          <h2 className={styles.ecosystemHeadline}>
            Education That<br />
            <span className={styles.ecosystemHeadlineAccent}>Reaches Everyone.</span>
          </h2>
          <p className={styles.ecosystemSubtext}>
            Your zip code shouldn&apos;t limit your education. Decentralization breaks down those barriers, receive intellectually refreshing lessons on things that truly matter in the real world.
          </p>
          <ul className={styles.ecosystemFeatureList}>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#5168FF' }} />
              Free EQ curriculums built by neuroscientists and published researchers.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#8B6BFF' }} />
              Quests tied to real goals — track progress, not just completions.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#3CC9B4' }} />
              Blockchain-verified credentials that go anywhere you do.
            </li>
          </ul>
          <LandingEnterAcademyButton />
        </div>
        <div className={styles.ecosystemDiagramWrap}>
          <ProblemMap />
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
          <p className={styles.heroTextBadge}>Mental Wealth Academy</p>
          <h1 className={styles.heroHeadline}>
            <span className={styles.heroHeadlineAccent}>The Next Gen</span>
            <span>Of Education</span>
          </h1>
          <p className={styles.heroSubtext}>
          Decentralized curriculums &amp; experiments led by a team of Neuroscientists. Unlocking human potential through goal-driven &amp; engaging quests.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton />
            <LandingEnterAsAgentButton />
          </div>
        </div>
        <div className={styles.heroVisualColumn} aria-hidden="true">
          <div className={styles.heroVisualFrame}>
            <Image
              src="/images/a.png"
              alt=""
              width={1254}
              height={1254}
              className={styles.heroVisualImage}
              priority
            />
          </div>
        </div>
      </div>

      <KeyFiguresSection />
    </>
  );
};

export default HeroSection;
