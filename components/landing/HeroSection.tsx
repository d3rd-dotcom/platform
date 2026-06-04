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
          The Heavy Tax On Our Mental Wealth<br />
          </h2>
          <p className={styles.ecosystemSubtext}>
            American Education is rooted in racism. As redlining inherits properties of segregation, separation of capital & resources remain dependent upon area-based income taxes. Low-income communities suffer and remain trapped by an invisible ceiling. By untethering world-class learning.
          </p>
          <ul className={styles.ecosystemFeatureList}>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#5168FF' }} />
              Increase mental wealth through virtually accessible curricula.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#8B6BFF' }} />
              Engaging Quests tied to USDC for accountability and growth.
            </li>
            <li className={styles.ecosystemFeatureItem}>
              <span className={styles.ecosystemFeatureDot} style={{ background: '#3CC9B4' }} />
              Blockchain-verified credentials and capable routes of learning.
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
            Your Reality is
            <span className={styles.heroHeadlineAccent}>Programmable.</span>
          </h1>
          <p className={styles.heroSubtext}>
          Any reality you wish to create is accessible in cyberspace. A Pocket-World with infinite possibilities.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
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
        {/* Mobile: viewport-anchored backdrop (frame ::before clips inside shell) */}
        <img
          src="/images/hero-shape.webp"
          alt=""
          className={styles.heroShapeBackdrop}
          aria-hidden
        />
      </div>

      <KeyFiguresSection />
    </>
  );
};

export default HeroSection;
