'use client';

import React, { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import styles from './EcosystemSection.module.css';

const words = [
  { text: 'Knowledge', reveal: 'Helps Us Grow' },
  { text: 'Quests', reveal: 'Learn and Earn' },
  { text: 'Community', reveal: 'is Mental Wealth' },
  { text: 'Education', reveal: 'Everybody Wins' },
  { text: 'Evolution', reveal: 'Heart of Tomorrow' },
];

export const EcosystemSection: React.FC = () => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    // Scope to this section: a global ScrollTrigger.getAll() kill here would
    // also destroy the page-level scroll experience's triggers.
    const ctx = gsap.context(() => {
      const textElements = gsap.utils.toArray<HTMLElement>(`.${styles.text}`);

      textElements.forEach((text) => {
        gsap.to(text, {
          backgroundSize: '100%',
          ease: 'none',
          scrollTrigger: {
            trigger: text,
            start: 'center 80%',
            end: 'center 20%',
            scrub: true,
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="value" className={styles.section}>
      <div className={styles.container}>
        <p className={styles.kicker}>Mental Wealth Is</p>
        {words.map((word, i) => (
          <h1 key={i} className={styles.text} data-landing-sound-hover>
            {word.text}
            <span>{word.reveal}</span>
          </h1>
        ))}
      </div>
    </section>
  );
};

export default EcosystemSection;
