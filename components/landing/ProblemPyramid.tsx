'use client';

import React from 'react';
import styles from './ProblemPyramid.module.css';

const tiers = [
  {
    label: 'Expensive Resources',
    sublabel: 'Top institutions locked behind tuition, debt, and geography',
    color: '#5168FF',
    width: '42%',
  },
  {
    label: 'Underserved Communities',
    sublabel: 'Proximity to tools determines who gets ahead',
    color: '#8B6BFF',
    width: '68%',
  },
  {
    label: 'EQ Courses — Free',
    sublabel: 'Neuroscience-backed curriculum, open to everyone',
    color: '#3CC9B4',
    width: '100%',
  },
];

export const ProblemPyramid: React.FC = () => (
  <div className={styles.wrap} role="img" aria-label="Pyramid showing what MWA solves">
    <div className={styles.stack}>
      {tiers.map((tier, i) => (
        <div key={i} className={styles.row} style={{ width: tier.width }}>
          <div className={styles.block} style={{ background: tier.color }}>
            <span className={styles.blockLabel}>{tier.label}</span>
          </div>
          <p className={styles.sublabel}>{tier.sublabel}</p>
        </div>
      ))}
    </div>
    <div className={styles.legend}>
      <span className={styles.legendDot} style={{ background: '#5168FF' }} />
      <span className={styles.legendText}>The problem</span>
      <span className={styles.legendDot} style={{ background: '#3CC9B4', marginLeft: 16 }} />
      <span className={styles.legendText}>The fix</span>
    </div>
  </div>
);

export default ProblemPyramid;
