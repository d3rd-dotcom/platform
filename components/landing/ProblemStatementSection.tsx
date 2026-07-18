'use client';

import React from 'react';
import ProblemMap from './ProblemMap';
import styles from './ProblemStatementSection.module.css';

export const ProblemStatementSection: React.FC = () => (
  <section id="problem" className={styles.section} aria-label="The problem">
    <div className={styles.container}>
      <div className={styles.board}>
        <div className={styles.boardHeader}>
          <span className={styles.headerIndex}>問題</span>
          <span className={styles.headerTitle}>THE PROBLEM</span>
        </div>
        <div className={styles.content}>
          <div className={styles.contextPanel}>
            <div className={styles.titlePanel}>
              <h2 className={styles.heading}>Education Inequality Is A Broken System.</h2>
            </div>
            <p className={styles.lead}>
              Average U.S. literacy is 6th grade level. Redlining shaped wealth
              across neighborhoods. Its effects still influence how education
              resources are distributed.
            </p>
            <div className={styles.budget}>
              <span className={styles.budgetTitle}>Annual funding per school</span>
              <div className={styles.budgetTable}>
                <span className={styles.budgetLabel} data-zone="red">Marginalized</span>
                <span className={styles.budgetCoins} aria-hidden="true"><i /></span>
                <span className={styles.budgetLabel} data-zone="green">Wealthy</span>
                <span className={styles.budgetCoins} aria-hidden="true"><i /><i /><i /></span>
                <span className={styles.budgetLabel} data-zone="private">Private</span>
                <span className={styles.budgetCoins} aria-hidden="true"><i /><i /><i /><i /><i /></span>
              </div>
            </div>
          </div>
          <div className={styles.mapPanel}>
            <ProblemMap />
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default ProblemStatementSection;
