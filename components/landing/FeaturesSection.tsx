'use client';

import { useEffect, useRef, useState } from 'react';

import LandingKnowledgeGraph from './LandingKnowledgeGraph';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    title: 'The Micro-University',
    description:
      'One verified guide per topic, level-gated so there are no duplicate tutorials to sort through.',
    details: ['Level-up and earn xp + rewards', 'Join a cohort of amazing builders and creators'],
  },
  {
    title: 'Quests With Blue',
    description:
      'The community uses Blue to turn what you are learning into real quests with real cash prizes.',
    details: ['Blue reviews every submission', 'Real USDC when you pass'],
  },
  {
    title: 'Invest In Your Future',
    description:
      'Mental Wealth is about creating a new form of digital space, and ecosystem that invests back in your future.',
    details: ['Gasless mints on Base', 'User-owned and transferable'],
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
        <p className={styles.sectionLead}>
          Because quality education shouldn&apos;t rely on a zip code.
        </p>
        <div className={styles.board}>
          <div className={styles.boardHeader}>
            <span className={styles.headerJa}>仕組み</span>
            <span className={styles.headerTitle}>The Next-Gen of Education</span>
          </div>

          <div className={styles.topPanel}>
            <div className={styles.graphPanel}>
              <LandingKnowledgeGraph />
            </div>

            <div className={styles.headlinePanel}>
              <h2 className={styles.title}>Access Quality Education</h2>
              <p className={styles.description}>
                617 million children and teens can&apos;t read a basic sentence or do simple math
                — and most are already in school. The lessons exist; the access doesn&apos;t. That
                gap is where dreams quietly disappear and true potential is lost.
              </p>
            </div>
          </div>

          <div className={styles.cardGrid}>
            {featureCards.map((card) => (
              <article key={card.title} className={styles.card}>
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
              </article>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
