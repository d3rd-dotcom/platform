'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import ForTeachersModal from './ForTeachersModal';
import { LandingScene } from './LandingScene';
import { PixelCursorTrail } from './PixelCursorTrail';
const HERO_HEADLINE = 'Vibe-learn any subject using AI-powered education.';

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
        {/* Keep the cursor field above the scene layers, below readable content. */}
        <PixelCursorTrail />
        <div className={styles.heroContent}>

          <h1 className={styles.heroHeadline}>
            {HERO_HEADLINE}
          </h1>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
            <ForTeachersModal />
          </div>
        </div>

      </div>
    </>
  );
};

export default HeroSection;
