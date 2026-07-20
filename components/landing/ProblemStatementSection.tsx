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
              <h2 className={styles.heading}>Learning moved online. The community got left behind.</h2>
            </div>
            <p className={styles.lead}>
              Redlining decided who could reach a good school. Then Blackboard,
              Moodle, and Canvas moved the classroom onto the internet and quietly
              dropped the part that made it work: the people around you.
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
