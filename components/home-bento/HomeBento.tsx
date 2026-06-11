'use client';

import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Dashboard from '@/components/dashboard/Dashboard';
import styles from './HomeBento.module.css';

// The home dashboard renders unconditionally. Personal-course creation lives
// in Blue's chat (via /courses) — gating /home behind a course record meant a
// user with no course was forced through the intake flow on every visit, and
// completing it silently recreated a course they had deleted.
export default function HomeBento() {
  const { authenticated } = usePrivy();

  return (
    <div className={`${styles.bentoScroll} ${styles.bentoScrollWithMorningNote}`}>
      <Dashboard enableMorningPagesPersistence={authenticated} />
    </div>
  );
}
