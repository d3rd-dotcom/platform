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
    title: 'Blue connects the dots',
    body: 'Blue reads your field notes, remembers your progress, and suggests the next node or mission to deepen what you are exploring.',
  },
  {
    num: '03',
    title: 'Let your work carry forward',
    body: 'Complete missions, earn credits for verified work, and strengthen the knowledge map for the people who follow your path.',
  },
];

export const HowItWorksSection: React.FC = () => (
  <section id="how-it-works" className={styles.section} aria-label="How it works">
    <div className={styles.container}>
      <p className={styles.eyebrow}>How it works</p>
      <h2 className={styles.heading}>Learn Where Curiosity Leads</h2>
      <p className={styles.lead}>
        Vibe-Learning means your curiosity sets the syllabus. Choose a mission.
        Record what you find. Blue builds the next one from there.
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
