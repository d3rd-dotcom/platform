'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AddToHomeScreenButton from '@/components/pwa/AddToHomeScreenButton';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    number: '01',
    title: 'Enter The Experiment',
    badge: 'Weekly',
    description:
      'A new app drops each week — a live behavioral study wrapped in a real case-study challenge. Show up and you are already doing science.',
    details: ['New content every week', 'Case-study format', 'IRB-style research design'],
    footerLabel: 'Season 1 cohort',
    footerValue: '12 weeks',
  },
  {
    number: '02',
    title: 'Contribute Real Insight',
    badge: 'Verified',
    description:
      'Complete prompts and generate useful behavioral data. Blue reads your submission, decides if you pass, and records your results to the shared dataset.',
    details: ['Complete the reading', 'Submit to Blue', 'Co-own the dataset'],
    footerLabel: 'Review time',
    footerValue: '~24 hrs',
  },
  {
    number: '03',
    title: 'Get Rewarded For Showing Up',
    badge: 'Onchain',
    description:
      "Earn cross-platform rewards for meaningful participation. Your diamonds live in your wallet — not on our servers — and compound the more you contribute.",
    details: ['Earn diamonds on-chain', 'Diamonds in your wallet', 'Convert to real value'],
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
      id="how-it-works"
      ref={sectionRef}
      className={`${styles.featuresSection} ${isVisible ? styles.sectionVisible : ''}`}
    >
      <div className={styles.container}>
        <div className={styles.board}>
          <div className={styles.boardHeader}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowAccent}>How It Works</span>
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
              <h2 className={styles.title}>&ldquo;Intellectually Refreshing&rdquo;</h2>
              <p className={styles.description}>
                Three steps. Weekly apps, real participation, real rewards.
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
