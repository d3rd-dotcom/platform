'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, type PanInfo } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import styles from './CourseFolderCard.module.css';

const FOLDER_PATH =
  'M0 26 Q0 2 24 2 H224 Q242 2 252 14 L266 32 Q276 44 292 44 H450 Q472 44 472 68 V304 Q472 328 448 328 H24 Q0 328 0 304 Z';

const TAB_DRAG_LIMIT = 40;
const TAB_DRAG_COMMIT = 26;

interface CourseFolderCardProps {
  title: string;
  count: number;
  href?: string;
  onOpen?: () => void;
  images: string[];
  ctaLabel?: string;
  dark?: boolean;
}

export default function CourseFolderCard({
  title,
  count,
  href,
  onOpen,
  images,
  ctaLabel = 'Start Course',
  dark,
}: CourseFolderCardProps) {
  const slots = images.slice(0, 4);
  const { play } = useSound();
  const router = useRouter();
  const [tabDragging, setTabDragging] = useState(false);

  // Pulling the tab down past the commit distance opens the folder,
  // mirroring the drag-a-tab interaction at lucasch.me.
  const openByTabPull = () => {
    play('click');
    if (href) router.push(href);
    else onOpen?.();
  };

  const contents = (
    <>
      {/* Folder body fill */}
      <svg className={styles.shape} viewBox="0 0 474 330" preserveAspectRatio="none" aria-hidden="true">
        <path d={FOLDER_PATH} className={styles.shapeFill} />
      </svg>

      {/* Folder contents */}
      <div className={styles.contents}>
        {slots.length > 0 ? (
          <div className={styles.imageGrid}>
            {slots.map((src, i) => (
              <span
                key={i}
                className={styles.imageSlot}
                style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
              />
            ))}
          </div>
        ) : (
          <svg className={styles.doodle} viewBox="0 0 418 214" aria-hidden="true">
            <circle cx="160" cy="90" r="70" className={styles.doodleRing} />
            <circle cx="230" cy="110" r="70" className={styles.doodleRing} />
            <circle cx="195" cy="60" r="70" className={styles.doodleRing} />
            <circle cx="255" cy="42" r="18" fill="#ffffff" />
            <circle cx="105" cy="128" r="18" fill="#ffe9e4" />
          </svg>
        )}
      </div>

      {/* Bottom gradient with progressive blur, under the stroke */}
      <div className={styles.bottomFade} aria-hidden="true" />

      {/* Border stroke on top of gradient */}
      <svg className={styles.shapeStrokeSvg} viewBox="0 0 474 330" preserveAspectRatio="none" aria-hidden="true">
        <path d={FOLDER_PATH} className={styles.shapeStroke} />
      </svg>

      {/* Tab label — drag it down to pull the folder open */}
      <motion.div
        className={styles.tabRow}
        drag="y"
        dragConstraints={{ top: 0, bottom: TAB_DRAG_LIMIT }}
        dragElastic={0.25}
        dragSnapToOrigin
        onDragStart={(e) => {
          e.stopPropagation();
          setTabDragging(true);
        }}
        onDragEnd={(e, info: PanInfo) => {
          e.stopPropagation();
          setTabDragging(false);
          if (info.offset.y >= TAB_DRAG_COMMIT) openByTabPull();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        style={{ cursor: tabDragging ? 'grabbing' : 'grab', touchAction: 'none' }}
      >
        <span className={styles.tabTitle}>{title}</span>
        <span className={styles.tabBadge}>{count}</span>
      </motion.div>

      {/* CTA */}
      <span
        className={styles.ctaOuter}
        onMouseEnter={(e) => {
          e.stopPropagation();
          play('hover');
        }}
      >
        <span className={styles.ctaInner}>{ctaLabel}</span>
      </span>
    </>
  );

  const cls = `${styles.folder} ${dark ? styles.folderDark : ''}`;

  if (href) {
    return (
      <Link
        href={href}
        className={cls}
        onMouseEnter={() => play('soft-hover')}
        onClick={() => play('click')}
      >
        {contents}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={`${cls} ${styles.folderButton}`}
      onMouseEnter={() => play('soft-hover')}
      onClick={() => {
        play('click');
        onOpen?.();
      }}
    >
      {contents}
    </button>
  );
}
