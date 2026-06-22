'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import LandingEnterAsAgentButton from './LandingEnterAsAgentButton';
import CompanyLogos from './CompanyLogos';

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>Next-Gen Cohort For Scientists &amp; Agents</p>
          <h1 className={styles.heroHeadline}>
            Do we Control
            <span className={styles.heroHeadlineAccent}>Our Destiny?</span>
          </h1>
          <p className={styles.heroSubtext}>
            You run real experiments on your own psychology, earn from what you learn, and walk away with a mind that works better than when you started.</p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
            <LandingEnterAsAgentButton />
          </div>
        </div>
        <div className={styles.heroVisualColumn} aria-hidden="true">
          <div className={styles.heroVisualFrame}>
            <Image
              src="/blue/blue-home.png"
              alt="Blue, the Academy mascot"
              width={742}
              height={705}
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

      <CompanyLogos />
    </>
  );
};

export default HeroSection;
