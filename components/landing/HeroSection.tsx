'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import GlitchRevealText from './GlitchRevealText';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import CompanyLogos from './CompanyLogos';

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
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
