'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import GlitchRevealText from './GlitchRevealText';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { LandingScene } from './LandingScene';

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <LandingScene />
        <Image
          src="/images/landing-starfield.jpg"
          alt=""
          fill
          sizes="100vw"
          className={styles.heroSpace}
          priority
          aria-hidden="true"
        />
        <Image
          src="/images/landing-earth.png"
          alt=""
          width={1024}
          height={1024}
          className={styles.heroEarth}
          priority
          aria-hidden="true"
        />
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>The Next-Gen Education Game For Students</p>
          <GlitchRevealText
            as="h1"
            className={styles.heroHeadline}
            lines={[
              { text: 'Global Quality Education' },
              { text: 'Built As A Video Game', accent: true },
            ]}
            accentClassName={styles.heroHeadlineAccent}
            staggerDelay={50}
            duration={1000}
            startDelay={200}
          />
          <div className={styles.heroLine} />
          <p className={styles.heroSubtext}>
            A micro-university for intellectual refreshment. Explore courses, guides, and quests
            while earning real rewards and Bitcoin. Blue, our agentic co-researcher, reviews your
            work, guides your progress, and keeps the joy of discovery in your hands.
          </p>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
          </div>
        </div>

      </div>
    </>
  );
};

export default HeroSection;
