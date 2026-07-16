'use client';

import React from 'react';
import styles from './HowItWorksSection.module.css';

const steps = [
  {
    num: '01',
    title: 'Learn, and contribute by learning',
    body: 'Sign up and take on missions. Write a field note on each one, in your own words. The note is the contribution, and the contribution earns.',
  },
  {
    num: '02',
    title: 'Blue reads the archive',
    body: 'Blue is the academy’s agent. She reviews what members write, then suggests your next topic, a new mission, or a story to play out in the gameworld.',
  },
  {
    num: '03',
    title: 'Earn diamonds, gain bitcoin reflections',
    body: 'Contributions pay Diamonds ($BLUE) onchain, on Base. Hold them, and the treasury’s cbBTC deposits reflect back to you in proportion to your balance.',
  },
];

export const HowItWorksSection: React.FC = () => (
  <section id="how-it-works" className={styles.section} aria-label="How it works">
    <div className={styles.container}>
      <p className={styles.eyebrow}>How it works</p>
      <h2 className={styles.heading}>Vibe-Learning, in three steps</h2>
      <p className={styles.lead}>
        Vibe-Learning means your curiosity sets the syllabus. You take the
        missions that interest you, write down what you find, and Blue builds
        the next one from that record.
      </p>

      <ol className={styles.steps}>
        {steps.map((step) => (
          <li key={step.num} className={styles.step}>
            <span className={styles.stepNum} aria-hidden="true">{step.num}</span>
            <h3 className={styles.stepTitle}>{step.title}</h3>
            <p className={styles.stepBody}>{step.body}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default HowItWorksSection;
