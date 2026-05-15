'use client';

import React from 'react';
import Image from 'next/image';
import { Flask, Microscope, TestTube, UsersThree } from '@phosphor-icons/react';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { KeyFiguresSection } from './KeyFiguresSection';

const ecosystemValueCards = [
  {
    value: 'Scientists',
    detail: 'Built for principal investigators and academic leaders running serious studies.',
    icon: Microscope,
  },
  {
    value: 'Researchers',
    detail: 'A home for research teams coordinating recruitment, insight collection, and analysis.',
    icon: Flask,
  },
  {
    value: 'Experiments',
    detail: 'Designed to support structured experiments, behavioral studies, and ongoing trials.',
    icon: TestTube,
  },
  {
    value: 'Participants',
    detail: 'Clear participation flows that help people join, respond, and stay engaged.',
    icon: UsersThree,
  },
] as const;

export const HeroSection: React.FC = () => {
  return (
    <>
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>100% of users earn rewards</p>
          <h1 className={styles.heroHeadline}>
            <span className={styles.heroHeadlineLead}>
              <span>A Psychic Spark</span>
              <span className={styles.heroHeadlineGifWrap} aria-hidden="true">
                <Image
                  src="/images/walking.gif"
                  alt=""
                  width={76}
                  height={94}
                  className={styles.heroHeadlineGif}
                />
              </span>
            </span>
            <span>For Your Evolution</span>
          </h1>
          <p className={styles.heroSubtext}>
            A modular 4-week Micro-University. Access Viral Oportunities, Transformative Bluesky Research. Reshape the future of humanity.
          </p>
          <p className={styles.heroSubtextSecondary}>
            Backed by research: decentralized systems drive up to 900% faster collaboration, and accountability feedback has raised adherence from 67% to 86% in randomized trials.
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

      <section className={styles.ecosystemSection} aria-label="Academy ecosystem">
        <div className={styles.ecosystemInner}>
          <h2 className={styles.ecosystemHeadline}>Revolutionized Psychology</h2>
          <p className={styles.ecosystemSubtext}>
            From first-time participants to seasoned researchers, the Academy rewards all forms of contribution and turns it into data with real value for humanity.
          </p>
          <div className={styles.heroValueCards} aria-label="Academy value summary">
            {ecosystemValueCards.map(({ value, detail, icon: Icon }) => (
              <article key={value} className={styles.heroValueCard}>
                <div className={styles.heroValueIconBox}>
                  <Icon
                    size={40}
                    weight="duotone"
                    className={styles.heroValueIcon}
                    aria-hidden="true"
                  />
                </div>
                <div className={styles.heroValueText}>
                  <p className={styles.heroValueMetric}>{value}</p>
                  <p className={styles.heroValueDetail}>{detail}</p>
                </div>
              </article>
            ))}
          </div>
          <div className={styles.ecosystemBanner}>
            <p className={styles.ecosystemBannerHeadline}>⚗️ We are active worldwide — remote-friendly, async-first</p>
            <p className={styles.ecosystemBannerSubtext}>
              Most academics meet 1-2x per week. Check-ins are flexible and fit around your life.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
