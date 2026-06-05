'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './page.module.css';

function getCourseEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 84); // 12 weeks
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function openCourseBuilder() {
  (window as Window & { __blueCourseBuilderOnOpen?: boolean }).__blueCourseBuilderOnOpen = true;
  window.dispatchEvent(new Event('toggleBlueChat'));
}

export default function CoursesPage() {
  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.heading}>Courses</h1>
          <p className={styles.subtext}>Choose a path or build your own with Blue.</p>
        </div>
        <div className={styles.grid}>

          <Link href="/course" className={styles.courseCard}>
            <div className={styles.courseImage}>
              <div className={styles.courseNoise} aria-hidden="true" />
              <div className={styles.courseIconBadge}>
                <BookOpen size={16} weight="duotone" />
              </div>
            </div>
            <div className={styles.courseBody}>
              <h2 className={styles.courseTitle}>Artist&apos;s Awakening</h2>
              <p className={styles.courseDesc}>
                A journey through rediscovering your creative energy and excavating it to reach your highest horizon.
              </p>
              <div className={styles.courseFoot}>
                <span className={styles.courseEndBadge}>End date: {getCourseEndDate()}</span>
                <span className={styles.courseStart}>Start →</span>
              </div>
            </div>
          </Link>

          <button type="button" onClick={openCourseBuilder} className={styles.buildCard}>
            <div className={styles.buildIcon}>
              <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
                <rect x="1" y="1" width="46" height="46" rx="11" stroke="currentColor" strokeWidth="2" />
                <line x1="24" y1="14" x2="24" y2="34" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                <line x1="14" y1="24" x2="34" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </button>

        </div>
      </main>
    </div>
  );
}
