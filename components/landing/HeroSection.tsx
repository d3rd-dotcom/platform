'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import LandingEnterAsAgentButton from './LandingEnterAsAgentButton';
import { KeyFiguresSection } from './KeyFiguresSection';

// One cluster = the 6 screenshots of a single app. We only have 6 shots for
// now, so the cluster is recycled each cycle; the animation cascades them in
// one by one, holds the group, then transitions out before the next cluster.
const appGroupScreens = [
  '/images/app1.png',
  '/images/app2.png',
  '/images/app3.png',
  '/images/app4.png',
  '/images/app5.png',
  '/images/app6.png',
] as const;

const APP_CASCADE_STEP = 0.2; // seconds between each shot dropping in

export const EcosystemSection: React.FC = () => (
  <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
    <div className={styles.ecosystemInner}>
      <h2 className={styles.ecosystemHeadline}>Cross-Platform Apps, Shared Rewards.</h2>
      <p className={styles.ecosystemSubtext}>
        Weekly apps. One reward layer across the ecosystem.
      </p>
      <div className={styles.appsLayout}>
        <div className={styles.appsImageCol}>
          <Image
            src="/images/academy-blockchain.png"
            alt="A blockchain node powering the Academy gem point-system"
            width={1698}
            height={1625}
            className={styles.appsImage}
          />
        </div>
        <div className={styles.appsScrollCol} aria-hidden="true">
          <div className={styles.appGroupRow}>
            {appGroupScreens.map((src, i) => (
              <Image
                key={src}
                src={src}
                alt=""
                width={490}
                height={1060}
                className={styles.appWaveShot}
                style={{ animationDelay: `${i * APP_CASCADE_STEP}s` }}
              />
            ))}
          </div>
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
          <p className={styles.heroTextBadge}>No endless scrolling. Structured growth.</p>
          <h1 className={styles.heroHeadline}>
            <span className={styles.heroHeadlineLead}>
              <span>The Blue Age</span>
            </span>
            <span className={styles.heroHeadlineSubline}>
              Of Human Evolution
            </span>
          </h1>
          <p className={styles.heroSubtext}>
            A new-age infrastructure reshaping human growth and potential — we combine psychology and gaming, to unlock your unlimited potential.
          </p>
          <p className={styles.heroSubtextSecondary}>
            Universal Credit System, Cross-Platform Rewards
          </p>
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
              width={1408}
              height={2000}
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
