'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, type PanInfo } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import styles from './CourseFolderCard.module.css';

const FOLDER_PATH =
  'M0 42 Q0 18 24 18 H224 Q242 18 252 30 L266 48 Q276 60 292 60 H450 Q472 60 472 84 V304 Q472 328 448 328 H24 Q0 328 0 304 Z';

const TAB_DRAG_LIMIT = 40;
const TAB_DRAG_COMMIT = 26;

interface CourseFolderCardProps {
  title: string;
  count: number;
  href?: string;
  onOpen?: () => void;
  images: string[];
  avatarSrc?: string;
  ctaLabel?: string;
  ctaDark?: boolean;
  dark?: boolean;
}

export default function CourseFolderCard({
  title,
  count,
  href,
  onOpen,
  images,
  avatarSrc,
  ctaLabel = 'Start Course',
  ctaDark = false,
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
      <div className={styles.folderSurface}>
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
      </div>

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
        <span
          className={styles.folderAvatar}
          style={avatarSrc ? { backgroundImage: `url(${JSON.stringify(avatarSrc)})` } : undefined}
          aria-hidden="true"
        />
        <span className={styles.tabTitle}>{title}</span>
      </motion.div>

      <span className={styles.tabBadge}>{count}</span>

      {/* CTA */}
      <span
        className={`${styles.ctaOuter} ${ctaDark ? styles.ctaOuterDark : ''}`}
        onMouseEnter={(e) => {
          e.stopPropagation();
          play('hover');
        }}
      >
        <span className={`${styles.ctaInner} ${ctaDark ? styles.ctaInnerDark : ''}`}>{ctaLabel}</span>
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
