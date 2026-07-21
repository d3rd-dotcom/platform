'use client';

import React from 'react';
import Image from 'next/image';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import ForTeachersModal from './ForTeachersModal';
import { LandingScene } from './LandingScene';
import HeroFloatingPanels from './HeroFloatingPanels';
import ThinkingOrbBadge from './ThinkingOrbBadge';
const HERO_HEADLINE = 'Open-sourced LMS platform to empower educators worldwide';

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
          <ThinkingOrbBadge
            label="Blue Thinking…"
            state="composing"
            size={64}
            displaySize={20}
            className={styles.heroOrbBadge}
          />

          <h1 className={styles.heroHeadline}>
            {HERO_HEADLINE}
          </h1>
          <div className={styles.heroActions}>
            <LandingEnterAcademyButton dark />
            <ForTeachersModal />
          </div>
        </div>

        <HeroFloatingPanels />
      </div>
    </>
  );
};

export default HeroSection;
