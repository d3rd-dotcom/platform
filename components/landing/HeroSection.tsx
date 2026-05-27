'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { KeyFiguresSection } from './KeyFiguresSection';
import ShardsAltar from './ShardsAltar';

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
      <h2 className={styles.ecosystemHeadline}>One Ecosystem, One Point System, Many Activities</h2>
      <p className={styles.ecosystemSubtext}>
        Earn cash and credits from activities as you level-up. Earned progress rewards are entirely owned by you and immutable through a decentralized blockchain account.
      </p>
      <div className={styles.appsLayout}>
        <div className={styles.appsImageCol}>
          <ShardsAltar />
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
              <span>New-Age Wellness</span>
            </span>
            <span className={styles.heroHeadlineSubline}>
              FOR PERSONAL GROWTH
            </span>
          </h1>
          <p className={styles.heroSubtext}>
            Mental Wealth Academy turns mental wellness into an engaging, trackable, collaborative experience instead of passive content.
          </p>
          <p className={styles.heroSubtextSecondary}>
            Universal Credit System, Cross-Platform Rewards
          </p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton />
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
