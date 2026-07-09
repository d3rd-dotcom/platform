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
        <Image
          src="/images/blueastro.png"
          alt=""
          width={400}
          height={400}
          className={styles.heroCharacter}
          priority
          aria-hidden="true"
        />
        <div className={styles.heroContent}>

          <GlitchRevealText
            as="h1"
            className={styles.heroHeadline}
            lines={[{ text: 'Academy' }]}
            staggerDelay={50}
            duration={1000}
            startDelay={200}
          />
          <p className={styles.heroSubtext}>
            Because learning is something everyone should have access to.
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
