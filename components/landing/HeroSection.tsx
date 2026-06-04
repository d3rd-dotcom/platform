'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { KeyFiguresSection } from './KeyFiguresSection';
import ProblemMap from './ProblemMap';

export const EcosystemSection: React.FC = () => (
  <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
    <div className={styles.ecosystemInner}>
      <div className={styles.ecosystemLayout}>
        <div className={styles.ecosystemCopy}>
          <p className={styles.ecosystemKicker}>Knowledge inequality</p>
          <h2 className={styles.ecosystemHeadline}>
          The Ability To Think Clearly Is Priceless<br />
          </h2>
          <p className={styles.ecosystemSubtext}>
            American Education is rooted in racism. As redlining inherits properties of segregation, separation of capital & resources remain dependent upon area-based income taxes. Low-income communities suffer and remain trapped by an invisible ceiling. By untethering world-class learning.
          </p>
          <ul className={styles.ecosystemFeatureList}>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#5168FF' }} />
              Increase mental wealth through digitally accessible curricula.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#8B6BFF' }} />
              Engaging Quests tied to real rewards increase accountability.
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
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>A New-Age Philosophy For Education</p>
          <h1 className={styles.heroHeadline}>
            yOur Reality is
            <span className={styles.heroHeadlineAccent}>Programmed.</span>
          </h1>
          <p className={styles.heroSubtext}>
          Any reality or tool you need is accessible in cyberspace. It's a Pocket-World connecting you to infinite possibilities.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton showIcon={false} />
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
