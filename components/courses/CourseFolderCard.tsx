'use client';

import React from 'react';
import Link from 'next/link';
import styles from './CourseFolderCard.module.css';

const FOLDER_PATH =
  'M0 26 Q0 2 24 2 H224 Q242 2 252 14 L266 32 Q276 44 292 44 H450 Q472 44 472 68 V304 Q472 328 448 328 H24 Q0 328 0 304 Z';

interface CourseFolderCardProps {
  title: string;
  count: number;
  href: string;
  images: string[];
  ctaLabel?: string;
}

export default function CourseFolderCard({
  title,
  count,
  href,
  images,
  ctaLabel = 'Start Course',
}: CourseFolderCardProps) {
  const slots = images.slice(0, 4);

  return (
    <Link href={href} className={styles.folder}>
      {/* Folder body fill */}
      <svg className={styles.shape} viewBox="0 0 474 330" preserveAspectRatio="none" aria-hidden="true">
        <path d={FOLDER_PATH} className={styles.shapeFill} />
      </svg>

      {/* Folder contents */}
      <div className={styles.contents}>
        <div className={styles.imageGrid}>
          {slots.map((src, i) => (
            <span
              key={i}
              className={styles.imageSlot}
              style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
            />
          ))}
        </div>
      </div>

      {/* Bottom gradient with progressive blur, under the stroke */}
      <div className={styles.bottomFade} aria-hidden="true" />

      {/* Border stroke on top of gradient */}
      <svg className={styles.shape} viewBox="0 0 474 330" preserveAspectRatio="none" aria-hidden="true">
        <path d={FOLDER_PATH} className={styles.shapeStroke} />
      </svg>

      {/* Tab label */}
      <div className={styles.tabRow}>
        <span className={styles.tabTitle}>{title}</span>
        <span className={styles.tabBadge}>{count}</span>
      </div>

      {/* CTA */}
      <span className={styles.ctaOuter}>
        <span className={styles.ctaInner}>{ctaLabel}</span>
      </span>
    </Link>
  );
}
