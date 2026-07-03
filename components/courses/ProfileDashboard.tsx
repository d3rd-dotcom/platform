'use client';

import React from 'react';
import styles from './ProfileDashboard.module.css';

interface ProfileStats {
  diamonds: number;
  courses: number;
  badges: number;
  streak: number;
}

interface ProfileDashboardProps {
  bannerUrl?: string | null;
  avatarUrl?: string | null;
  level: number;
  headline: string;
  description: string;
  stats: ProfileStats;
  missionLabel?: string;
  friendAvatars?: string[];
}

export default function ProfileDashboard({
  bannerUrl,
  avatarUrl,
  level,
  headline,
  description,
  stats,
  missionLabel,
  friendAvatars = [],
}: ProfileDashboardProps) {
  return (
    <section className={styles.panel}>
      <div
        className={styles.banner}
        style={bannerUrl ? { backgroundImage: `url(${JSON.stringify(bannerUrl)})` } : undefined}
      />
      <div
        className={styles.avatar}
        style={avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined}
      />

      <div className={styles.header}>
        <h2 className={styles.title}>User Profile</h2>
        <span className={styles.levelPill}>Level {level}</span>
        <div className={styles.headerDivider} />
      </div>

      <div className={styles.about}>
        <span className={styles.headline}>{headline}</span>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.diamonds.toLocaleString()}</span>
          <span className={styles.statLabel}>Diamonds</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.courses}</span>
          <span className={styles.statLabel}>Courses</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.badges}</span>
          <span className={styles.statLabel}>Badges</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{stats.streak}</span>
          <span className={styles.statLabel}>Streak</span>
        </div>
      </div>

      <div className={styles.mission}>
        <span className={styles.missionHeading}>Current Mission</span>
        <div className={styles.missionCard}>
          {missionLabel && <span className={styles.missionLabel}>{missionLabel}</span>}
        </div>
      </div>

      <div className={styles.controlPanel}>
        {friendAvatars.slice(0, 3).map((src, i) => (
          <span
            key={i}
            className={styles.controlAvatar}
            style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
          />
        ))}
        <span className={styles.controlAction} />
      </div>
    </section>
  );
}
