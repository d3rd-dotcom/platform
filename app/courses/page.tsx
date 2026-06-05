'use client';

import React from 'react';
import Link from 'next/link';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from './page.module.css';

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
            <div className={styles.cardMeta}>
              <span className={styles.cardMetaLeft}>12 weeks</span>
            </div>
            <h2 className={styles.courseTitle}>Shadow Work</h2>
            <p className={styles.courseDesc}>
              A journey through safety, identity, power, and trust. Built on creative recovery practices.
            </p>
            <span className={styles.courseStart}>Start course →</span>
          </Link>

          <button type="button" onClick={openCourseBuilder} className={styles.buildCard}>
            <div className={styles.cardMeta}>
              <span className={styles.cardMetaLeftDark}>4 weeks</span>
              <span className={styles.plusIcon}>
                <svg viewBox="0 0 20 20" fill="none" width="18" height="18">
                  <rect x="0.5" y="0.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="1.2" />
                  <line x1="10" y1="5" x2="10" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            </div>
            <h2 className={styles.buildTitle}>Blue Course</h2>
            <p className={styles.buildDesc}>
              Tell Blue what you want to learn and she generates a 4-week course around it.
            </p>
            <span className={styles.buildStart}>Build with Blue →</span>
          </button>

        </div>
      </main>
    </div>
  );
}
