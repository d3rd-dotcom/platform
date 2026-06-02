'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './BlueVideoPanel.module.css';

const BLUE_VIDEO_SRC = '/videos/bluehome.mp4';

interface BlueVideoPanelProps {
  /** Caption shown beside the video — Blue's current line. */
  message: string;
  /** Small label above the caption. Defaults to "Blue". */
  eyebrow?: string;
  className?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
}

/**
 * The looping Blue video piece from the survey's control panel, reused on
 * /quests in place of the old chat bubble. Defers loading the mp4 until the
 * panel scrolls into view (and the main thread is idle) to keep it cheap.
 */
export default function BlueVideoPanel({
  message,
  eyebrow = 'Blue',
  className = '',
  ariaLive = 'polite',
}: BlueVideoPanelProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldLoad) return;
    const el = wrapRef.current;
    if (!el) return;

    const load = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => setShouldLoad(true), { timeout: 1800 });
        return;
      }
      setTimeout(() => setShouldLoad(true), 900);
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        load();
      },
      { rootMargin: '160px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div className={`${styles.panel} ${className}`} ref={wrapRef}>
      <div className={styles.videoWrapper}>
        {shouldLoad ? (
          <>
            <video
              className={`${styles.video} ${isReady ? styles.videoReady : ''}`}
              src={BLUE_VIDEO_SRC}
              autoPlay
              loop
              muted
              playsInline
              preload="metadata"
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback"
              aria-label="Blue avatar"
              onLoadedData={() => setIsReady(true)}
              onCanPlay={() => setIsReady(true)}
            />
            {!isReady && <div className={styles.loadingShell} aria-hidden="true" />}
          </>
        ) : (
          <div className={styles.loadingShell} aria-hidden="true" />
        )}
      </div>
      <div className={styles.review} aria-live={ariaLive}>
        <span className={styles.reviewEyebrow}>{eyebrow}</span>
        <p className={styles.reviewText}>{message}</p>
      </div>
    </div>
  );
}
