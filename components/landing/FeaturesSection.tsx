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
      'Each week, the Academy opens a new experience designed to capture how people think, feel, and respond.',
    details: ['A new drop every week', 'Fast to join', 'Built for participation'],
    footerLabel: 'Starts with',
    footerValue: 'One open call',
  },
  {
    number: '02',
    title: 'Contribute Real Insight',
    badge: 'Research',
    description:
      'Your reflections, behavior, and responses become structured research inputs that help map real human patterns.',
    details: ['Respond to prompts', 'Complete the experience', 'Turn participation into data'],
    footerLabel: 'Output',
    footerValue: 'Usable findings',
  },
  {
    number: '03',
    title: 'Get Rewarded For Showing Up',
    badge: 'Value',
    description:
      'The Academy tracks meaningful contribution and returns value back to the people moving the research forward.',
    details: ['Incentives stay clear', 'Progress is easy to track', 'Contribution does not disappear'],
    footerLabel: 'Result',
    footerValue: 'Shared upside',
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
