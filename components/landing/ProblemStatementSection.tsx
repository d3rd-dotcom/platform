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
          <span className={styles.headerTitle}>The Problem</span>
        </div>
        <div className={styles.content}>
          <div className={styles.contextPanel}>
            <div className={styles.titlePanel}>
              <h2 className={styles.heading}>Education Inequality Follows The Map.</h2>
            </div>
            <p className={styles.lead}>
              Historic redlining shaped neighborhood wealth. School resources
              still reflect where students live.
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
