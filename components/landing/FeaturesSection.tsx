'use client';

import { useEffect, useRef, useState } from 'react';

import LandingKnowledgeGraph from './LandingKnowledgeGraph';
import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    title: 'Learn Any Topic',
    description:
      'Go as deep as you want. Explore unique topics and subjects suggested by Blue and peer-reviewed by humans.',
    details: ['Level-up and earn xp + rewards', 'Join a cohort of intellectual refreshment'],
  },
  {
    title: 'A Living Knowledge Network',
    description:
      'The community uses Blue to turn what you are learning into real quests with real cash prizes.',
    details: ['Blue reviews your work and suggests the next step', 'Approved quests earn cash rewards'],
  },
  {
    title: 'Build Knowledge That Compounds',
    description:
      'Every completed guide and thoughtful contribution strengthens the knowledge network. Earn rewards for work that helps more people learn with confidence.',
    details: ['Credits for verified contributions', 'Peer review keeps knowledge trustworthy'],
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
          Because quality education shouldn&apos;t rely on wealth.
        </p>
        <div className={styles.board}>
          <div className={styles.boardHeader}>
            <span className={styles.headerJa}>仕組み</span>
            <span className={styles.headerTitle}>The Next-Gen of Education</span>
          </div>

          <div className={styles.topPanel}>
            <div className={styles.headlinePanel}>
              <h2 className={styles.title}>AI Powered Learning Nodes</h2>
              <p className={styles.description}>
                Each Academy subject becomes a path of connected, verified nodes. Follow the
                foundations into deeper ideas. Blue autonomously suggests your next node from
                your progress, giving you a course of study shaped by your questions.
              </p>
            </div>

            <div className={styles.graphPanel}>
              <LandingKnowledgeGraph />
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
