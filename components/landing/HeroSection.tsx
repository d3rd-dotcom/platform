'use client';

import React from 'react';
import Image from 'next/image';
import { Microscope, TestTube, UsersThree } from '@phosphor-icons/react';
import type { ComponentProps, ComponentType } from 'react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import { KeyFiguresSection } from './KeyFiguresSection';

type IconProps = ComponentProps<'svg'> & { size?: number; weight?: string };

const ShardOutlineIcon: ComponentType<IconProps> = ({ size = 40, weight: _weight, ...rest }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    strokeWidth={28}
    strokeLinejoin="round"
    strokeLinecap="round"
    {...rest}
  >
    <path d="M89.55 46.28 H422.01 L511.38 179.51 L257.77 465.72 L0 179.77 Z" />
    <path d="M0 179.77 H512" />
    <path d="M89.55 46.28 L151.73 180.33 L257.77 465.72 L360.27 180.33 L422.01 46.28" />
    <path d="M257.83 46.28 V180.33" />
  </svg>
);

const ecosystemValueCards = [
  {
    value: 'Scientists',
    detail: 'Built for principal investigators and academic leaders running serious studies.',
    icon: Microscope,
  },
  {
    value: 'Students',
    detail: 'Earn shards for every contribution — they convert into real rewards and standing in the Academy.',
    icon: ShardOutlineIcon,
  },
  {
    value: 'Founders',
    detail: 'Designed to support structured experiments, behavioral studies, and ongoing trials.',
    icon: TestTube,
  },
  {
    value: 'Communities',
    detail: 'Clear participation flows that help people join, respond, and stay engaged.',
    icon: UsersThree,
  },
] as const;

export const HeroSection: React.FC = () => {
  const { play } = useSound();
  return (
    <>
      <div className={styles.heroSection}>
        <div className={styles.heroContent}>
          <p className={styles.heroTextBadge}>100% of users earn rewards</p>
          <h1 className={styles.heroHeadline}>
            <span className={styles.heroHeadlineLead}>
              <span>Learn How Your</span>
              <span className={styles.heroHeadlineGifWrap} aria-hidden="true">
                <Image
                  src="/images/walking.gif?v=2"
                  alt=""
                  width={76}
                  height={94}
                  className={styles.heroHeadlineGif}
                />
              </span>
            </span>
            <span className={styles.heroHeadlineSubline}>
              Mind Really Works
            </span>
          </h1>
          <p className={styles.heroSubtext}>
            An AI research academy where people learn money, emotions, and habits through AI-guided behavioral research and rewards.
          </p>
          <p className={styles.heroSubtextSecondary}>
            Research backed: decentralized rewards drive 900% more participation; accountability feedback improved completion rates by 86%.
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

      <section id="value" className={styles.ecosystemSection} aria-label="Academy ecosystem">
        <div className={styles.ecosystemInner}>
          <h2 className={styles.ecosystemHeadline}>Who it&apos;s Built For</h2>
          <p className={styles.ecosystemSubtext}>
            From first-time participants to seasoned researchers, the Academy rewards all forms of contribution and turns it into data with real value for humanity.
          </p>
          <div className={styles.heroValueCards} aria-label="Academy value summary">
            {ecosystemValueCards.map(({ value, detail, icon: Icon }) => (
              <article
                key={value}
                className={styles.heroValueCard}
                onMouseEnter={() => play('hover')}
                onClick={() => play('click')}
              >
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
            <p className={styles.ecosystemBannerHeadline}>🌍 A global cohort — remote-friendly and async-first</p>
            <p className={styles.ecosystemBannerSubtext}>
              Most academics check in once or twice a week, on their own schedule. The work fits around your life — not the other way around.
            </p>
          </div>
        </div>
      </section>
    </>
  );
};

export default HeroSection;
