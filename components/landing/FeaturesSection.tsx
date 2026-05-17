'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import AddToHomeScreenButton from '@/components/pwa/AddToHomeScreenButton';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    title: 'Enter The Experiment',
    description: 'A new app drops each week.',
  },
  {
    title: 'Contribute Real Insight',
    description: 'Complete prompts and generate useful behavioral data.',
  },
  {
    title: 'Get Rewarded For Showing Up',
    description: 'Earn cross-platform rewards for meaningful participation.',
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
                Three steps. Weekly apps, real participation, real rewards.
              </p>
              <AddToHomeScreenButton className={styles.ctaButton} />
            </div>
          </div>

          <div className={styles.cardGrid}>
            {featureCards.map((card) => (
              <article key={card.title} className={styles.card}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDescription}>{card.description}</p>
              </article>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
