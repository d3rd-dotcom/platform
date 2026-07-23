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
          <span className={styles.headerTitle}>Education infrastructure</span>
        </div>
        <div className={styles.content}>
          <div className={styles.contextPanel}>
            <div className={styles.titlePanel}>
              <h2 className={styles.heading}>Modern systems fail to empower quality educators.</h2>
            </div>
            <p className={styles.lead}>
              Schools struggle when qualified teachers are scarce, especially when
              their infrastructure is not designed for the people who use it. Mental
              Wealth Academy is open and self-hostable, so a small team of experts
              can reach far more learners.
            </p>
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
