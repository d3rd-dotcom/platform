'use client';

import { useEffect, useRef, useState } from 'react';

import LandingKnowledgeGraph from './LandingKnowledgeGraph';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    number: '01',
    title: 'A Micro-University For Intellectual Refreshment',
    badge: 'Courses',
    description:
      'One canonical, verified guide per topic, level-gated so there\'s no duplicate tutorials to sort through. You clear levels instead of grinding through tutorial hell, and every course stays free.',
    details: ['One verified guide per topic', 'Level up instead of grinding', 'Free, always'],
    footerLabel: 'First season',
    footerValue: '12 weeks',
  },
  {
    number: '02',
    title: 'A Curriculum Accompanied By Blue',
    badge: 'Quests',
    description:
      'Blue turns what you\'re learning into real quests. She reviews your submissions, asks for a revision when one\'s needed, and pays real USDC when your work is ready.',
    details: ['Blue reviews every submission', 'Real-world accountability', 'Real USDC when you pass'],
    footerLabel: 'Review time',
    footerValue: '~24 hrs',
  },
  {
    number: '03',
    title: 'Lifetime Ownership',
    badge: 'Onchain',
    description:
      'Diamonds ($BLUE) mint gasless, straight to your wallet on Base — no signing, no gas. Blue holds 20% of the supply and pays quest rewards from her own stash.',
    details: ['Gasless mints on Base', 'Blue pays from her own wallet', 'User-owned and transferable'],
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
      { threshold: 0.2, rootMargin: '0px 0px -60px 0px' }
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
            <div className={styles.graphPanel}>
              <LandingKnowledgeGraph />
            </div>

            <div className={styles.headlinePanel}>
              <h2 className={styles.title}>How Can We Reach Our Dreams?</h2>
              <p className={styles.description}>
                Every verified guide joins the same prerequisite graph. Rotate the map, trace a
                topic back to its foundations, and find the next concept ready to explore.
              </p>
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
