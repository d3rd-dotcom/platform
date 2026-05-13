'use client';

import React from 'react';
import Image from 'next/image';
import { ChartLineUp, ClipboardText, Robot } from '@phosphor-icons/react';
import styles from './LandingPage.module.css';
import AddToHomeScreenButton from '@/components/pwa/AddToHomeScreenButton';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';

const heroValueCards = [
  {
    title: 'Paid Research',
    value: 'USDC',
    detail: 'Take surveys and turn useful data into stablecoin rewards.',
    icon: ClipboardText,
    tone: 'blue',
  },
  {
    title: 'Game Currency',
    value: 'Shards',
    detail: 'Earn in-app currency from quests, streaks, and play.',
    iconSrc: '/icons/ui-shard.svg',
    tone: 'green',
  },
  {
    title: 'AI Agent',
    value: 'Prize Boost',
    detail: 'Activate an agent that finds higher-value reward routes.',
    icon: Robot,
    tone: 'violet',
  },
  {
    title: 'Reward Markets',
    value: 'Cash Prizes',
    detail: 'Compete in experiments, predictions, and quests.',
    icon: ChartLineUp,
    tone: 'gold',
  },
] as const;

const rotatingHeroWords = ['Learning', 'Community', 'Rewards'] as const;
const heroRotatingWordsLoop = [...rotatingHeroWords, rotatingHeroWords[0]] as const;
const longestHeroWord = 'Community';

export const HeroSection: React.FC = () => {
  return (
    <div className={styles.heroSection}>
      <div className={styles.heroContent}>
        <div className={styles.heroLogoSurface}>
          <Image
            src="/icons/icon-512.png"
            alt="Mental Wealth Academy"
            width={96}
            height={96}
            className={styles.heroPwaLogo}
            priority
          />
        </div>
        <h1 className={styles.heroHeadline}>
          <span>A Micro-University</span>
          <span className={styles.heroHeadlineRotatingLine}>
            <span>For Real</span>
            <span className={styles.heroHeadlineWordViewport}>
              <span className={styles.heroHeadlineWordSizer} aria-hidden="true">
                {longestHeroWord}
              </span>
              <span className={styles.heroHeadlineWordTrack} aria-hidden="true">
                {heroRotatingWordsLoop.map((word, index) => (
                  <span key={`${word}-${index}`} className={styles.heroHeadlineWord}>
                    {word}
                  </span>
                ))}
              </span>
              <span className={styles.heroHeadlineSrOnly}>{rotatingHeroWords[0]}</span>
            </span>
          </span>
        </h1>
        <p className={styles.heroSubtext}>
          College is overpriced and overrated. You can learn cool things without a $10,000 loan. Here, you&apos;ll get closer to the expert version of yourself.
        </p>
        <div className={styles.heroActions}>
          <LandingEnterAcademyButton />
          <AddToHomeScreenButton className={`${styles.heroButton} ${styles.heroButtonSecondary}`} />
        </div>
        <div className={styles.heroValueCards} aria-label="Academy value summary">
          {heroValueCards.map(({ title, value, detail, tone, ...card }) => (
            <article key={title} className={styles.heroValueCard}>
              <div className={styles.heroValueCardTop}>
                <p className={styles.heroValueTitle}>{title}</p>
                {'iconSrc' in card ? (
                  <Image
                    src={card.iconSrc}
                    alt=""
                    width={34}
                    height={34}
                    className={`${styles.heroValueIcon} ${styles.heroValueImageIcon} ${styles[`heroValueIcon_${tone}`]}`}
                    aria-hidden="true"
                  />
                ) : (
                  <card.icon
                    size={34}
                    weight="duotone"
                    className={`${styles.heroValueIcon} ${styles[`heroValueIcon_${tone}`]}`}
                    aria-hidden="true"
                  />
                )}
              </div>
              <p className={styles.heroValueMetric}>{value}</p>
              <p className={styles.heroValueDetail}>{detail}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
