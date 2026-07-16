'use client';

import React from 'react';
import ProblemMap from './ProblemMap';
import styles from './ProblemStatementSection.module.css';

export const ProblemStatementSection: React.FC = () => (
  <section id="problem" className={styles.section} aria-label="The problem">
    <div className={styles.container}>
      <p className={styles.eyebrow}>The problem</p>
      <h2 className={styles.heading}>
        A map drawn in the 1930s still sets what a school can spend.
      </h2>
      <p className={styles.lead}>
        The federal Home Owners&apos; Loan Corporation graded American
        neighborhoods for lending risk. Grade A meant best. Grade D meant
        hazardous, and it was outlined in red. Below is Oakland, California,
        drawn from the original survey.
      </p>

      <ProblemMap />

      <p className={styles.close}>
        Quality education still tracks a property line. Our courses are free,
        and open to anyone 18 and up.
      </p>
    </div>
  </section>
);

export default ProblemStatementSection;
