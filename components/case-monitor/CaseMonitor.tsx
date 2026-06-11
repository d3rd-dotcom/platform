'use client';

import React, { useEffect, useState } from 'react';
import styles from './CaseMonitor.module.css';

interface SimCase {
  id: string;
  label: string;
  name: string;
  capacity: number;
  initial: number;
}

const CASES: SimCase[] = [
  { id: 'case-1', label: 'Case 01', name: 'Meadow district', capacity: 2400, initial: 1742 },
  { id: 'case-2', label: 'Case 02', name: 'Night market', capacity: 1800, initial: 1289 },
  { id: 'case-3', label: 'Case 03', name: 'Harbor commons', capacity: 3200, initial: 2451 },
];

const TICK_MS = 2400;

function statusFor(ratio: number): string {
  if (ratio < 0.62) return 'calm';
  if (ratio < 0.8) return 'steady';
  if (ratio < 0.92) return 'lively';
  return 'crowded';
}

export default function CaseMonitor() {
  const [humans, setHumans] = useState<number[]>(CASES.map((c) => c.initial));

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.hidden) return;
      setHumans((prev) =>
        prev.map((value, i) => {
          const cap = CASES[i].capacity;
          const drift = Math.round((Math.random() - 0.46) * cap * 0.03);
          const floor = Math.round(cap * 0.42);
          const ceiling = Math.round(cap * 0.97);
          return Math.min(ceiling, Math.max(floor, value + drift));
        }),
      );
    }, TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const totalHumans = humans.reduce((a, b) => a + b, 0);
  const totalCapacity = CASES.reduce((a, c) => a + c.capacity, 0);

  const rows = [
    ...CASES.map((c, i) => ({
      key: c.id,
      label: c.label,
      name: c.name,
      value: humans[i],
      capacity: c.capacity,
      isTotal: false,
    })),
    {
      key: 'total',
      label: 'Total',
      name: 'Azure World',
      value: totalHumans,
      capacity: totalCapacity,
      isTotal: true,
    },
  ];

  return (
    <section className={styles.monitor} aria-label="Simulation case monitor">
      <header className={styles.head}>
        <span className={styles.headTitle}>
          <span className={styles.liveDot} aria-hidden="true" />
          Case monitor
        </span>
        <span className={styles.headMeta}>3 cases · engine online</span>
      </header>

      <div className={styles.rows}>
        {rows.map((row) => {
          const ratio = Math.min(1, row.value / row.capacity);
          return (
            <div
              key={row.key}
              className={`${styles.row} ${row.isTotal ? styles.rowTotal : ''}`}
            >
              <div className={styles.rowId}>
                <span className={styles.rowLabel}>{row.label}</span>
                <span className={styles.rowName}>{row.name}</span>
              </div>
              <div
                className={styles.gauge}
                role="img"
                aria-label={`${row.name}: ${row.value.toLocaleString()} simulated humans`}
              >
                <span
                  className={styles.gaugeFill}
                  style={{ width: `${(ratio * 100).toFixed(1)}%` }}
                  aria-hidden="true"
                />
                <span className={styles.gaugeValue}>
                  {row.value.toLocaleString()} humans
                </span>
              </div>
              <span className={styles.rowStatus}>{statusFor(ratio)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
