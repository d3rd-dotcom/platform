'use client';

import React from 'react';
import LandingEnterAcademyButton from './LandingEnterAcademyButton';
import styles from './FinalCtaSection.module.css';

export const FinalCtaSection: React.FC = () => (
  <section className={styles.section} aria-label="Join the academy">
    <div className={styles.container}>
      <h2 className={styles.heading}>Start with one mission.</h2>
      <LandingEnterAcademyButton />
    </div>
  </section>
);

export default FinalCtaSection;
