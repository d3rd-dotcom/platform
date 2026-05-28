'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import LandingEnterAsAgentButton from './LandingEnterAsAgentButton';
import CompanyLogos from './CompanyLogos';
import OrbitalDiagram from './OrbitalDiagram';

export const EcosystemSection: React.FC = () => (
  <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
    <div className={styles.ecosystemInner}>
      <h2 className={styles.ecosystemHeadline}>
        One ecosystem. <span className={styles.ecosystemHeadlineAccent}>One point system.</span> Many ways in.
      </h2>
      <p className={styles.ecosystemSubtext}>
        Every quest, course, simulation, and trade adds to the same balance — yours, kept on-chain so it travels with you. No siloed scores, no resets.
      </p>

      <OrbitalDiagram />

      <div className={styles.ecosystemBanner}>
        <div className={styles.ecosystemBannerCopy}>
          <p className={styles.ecosystemBannerHeadline}>Pick any door. They all earn the same points.</p>
          <p className={styles.ecosystemBannerSubtext}>
            Start with a daily quest, drop into a livestream, or run a simulation — your progress compounds in one wallet.
          </p>
        </div>
        <Link href="/home" className={styles.ecosystemBannerCta}>
          Enter the Academy
        </Link>
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
            src="/images/hero-app-shot.png"
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
