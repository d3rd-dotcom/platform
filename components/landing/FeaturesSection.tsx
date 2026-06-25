'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import styles from './FeaturesSection.module.css';

const featureCards = [
  {
    number: '01',
    title: 'Simulate Your World',
    badge: 'Simulation',
    description:
      'Create a God\'s eye view of your life, your quest, and your hypothesis. Let swarms of agents strategize and present to you alternative possible realities.',
    details: ['Map your life as a simulation', 'Agents generate alternative realities', 'Choose your hypothesis to test'],
    footerLabel: 'Season 1 cohort',
    footerValue: '12 weeks',
  },
  {
    number: '02',
    title: 'Design Curriculums & Quests',
    badge: 'Quests',
    description:
      'Answer questions from B.L.U.E., who turns potential futures into actionable quests... with real-life rewards and USDC for touching grass and kicking ass!',
    details: ['B.L.U.E. designs your quests', 'Real-world accountability', 'Earn USDC for touching grass'],
    footerLabel: 'Review time',
    footerValue: '~24 hrs',
  },
  {
    number: '03',
    title: 'Become a Researcher',
    badge: 'Classified',
    description:
      'Once you level up, you gain access to classified tools. Memberships can be earned or purchased. Become a gear in the machine steering our world, forward.',
    details: ['Level up to unlock classified tools', 'Earn or purchase membership', 'Shape the future as a gear in the machine'],
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
            <div className={styles.phonePanel}>
              <div className={styles.phoneStack}>
                <div className={`${styles.phoneMockup} ${styles.phoneRear} ${styles.phoneReveal}`}>
                  <Image
                    src="/uploads/mockup-app-landing-2.png"
                    alt="Course reading screen on phone"
                    fill
                    sizes="140px"
                    className={styles.phoneImage}
                  />
                </div>
                <div className={`${styles.phoneMockup} ${styles.phoneFront} ${styles.phoneReveal}`}>
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
                Three steps. Simulate your world, design your quests, earn your place.
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
