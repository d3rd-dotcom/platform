'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AddToHomeScreenButton from '@/components/pwa/AddToHomeScreenButton';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    number: '01',
    title: 'New Experiments Every Week',
    badge: 'DeSci',
    description:
      'Twelve weeks of quests, readings, and field studies. Real start, real end — applied behavioral research with collaborators who publish.',
    details: ['IRB-style research design', 'You co-own the dataset', 'Credentials that compound'],
    footerLabel: 'Season 1 cohort',
    footerValue: '12 weeks',
  },
  {
    number: '02',
    title: 'Participatory Research',
    badge: 'Weekly',
    description:
      'B.L.U.E. reads every submission and pays out the reward. Your reflections become training data. Her judgments evolve as you do.',
    details: ['Complete the reading', 'Submit to B.L.U.E.', 'Earn shards on-chain'],
    footerLabel: 'Week one reward',
    footerValue: '382 shards',
  },
  {
    number: '03',
    title: 'Universal Credit System',
    badge: 'Yours Forever',
    description:
      'On-chain credits earned in one case-study app, spendable across all of them. $Shards live in your wallet — not on our servers.',
    details: ['Earn while you study', 'Credits in your wallet', 'Convert to real cash'],
    footerLabel: 'On Base blockchain',
    footerValue: 'User-owned',
  },
];

export const FeaturesSection: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.08 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`${styles.featuresSection} ${isVisible ? styles.sectionVisible : ''}`}
    >
      <div className={styles.container}>
        <div className={styles.board}>

          <div className={styles.boardHeader}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowAccent}>The Lab</span>
            </p>
          </div>

          <div className={styles.topPanel}>
            <div className={styles.phonePanel}>
              <div className={styles.phoneStack}>
                <div className={`${styles.phoneMockup} ${styles.phoneRear}`}>
                  <Image
                    src="/uploads/mockup-app-landing-2.png"
                    alt="Course reading screen on phone"
                    fill
                    sizes="140px"
                    className={styles.phoneImage}
                  />
                </div>
                <div className={`${styles.phoneMockup} ${styles.phoneFront}`}>
                  <Image
                    src="/uploads/mockup-app-landing.png"
                    alt="Week one tasks screen on phone"
                    fill
                    sizes="155px"
                    className={styles.phoneImage}
                  />
                </div>
              </div>
            </div>

            <div className={styles.headlinePanel}>
              <h2 className={styles.title}>How It Works</h2>
              <p className={styles.description}>
                New apps each week and point systems turned to real cash.
              </p>
              <AddToHomeScreenButton className={styles.ctaButton} />
            </div>
          </div>

          <div className={styles.cardGrid}>
            {featureCards.map((card) => (
              <article key={card.number} className={styles.card}>
                <div className={styles.cardTop}>
                  <span className={styles.cardNumber}>{card.number}</span>
                  <span className={styles.badge}>{card.badge}</span>
                </div>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDescription}>{card.description}</p>
                <div className={styles.cardList}>
                  {card.details.map((detail) => (
                    <div key={detail} className={styles.cardListItem}>
                      <span className={styles.listDot} />
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
                <div className={styles.cardFooter}>
                  <span>{card.footerLabel}</span>
                  <strong>{card.footerValue}</strong>
                </div>
              </article>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
