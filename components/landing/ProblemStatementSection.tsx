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
              <h2 className={styles.heading}>Poor nations face a severe shortage of qualified teachers.</h2>
            </div>
            <p className={styles.lead}>
              When qualified teachers are scarce, schools struggle to compensate.
              Yet, most course platforms assume this problem has already been solved,
              providing software for classrooms that remain unstaffed. We built our
              open, self-hostable platform to change this: it enables a small group
              of experts to reach exponentially more learners.
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
