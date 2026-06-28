'use client';

import { useRef, useState, useCallback } from 'react';
import BlueScene from '@/components/blue-scene/BlueScene';
import DNAMusicBox from '@/components/dna-music-box/DNAMusicBox';
import styles from './SwipeableScene.module.css';

export default function SwipeableScene() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(idx);
  }, []);

  const goTo = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' });
    setActiveIndex(index);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.track} ref={trackRef} onScroll={handleScroll}>
        <div className={styles.slide}><BlueScene /></div>
        <div className={styles.slide}><DNAMusicBox /></div>
      </div>
      <nav className={styles.dots} aria-label="Scene carousel">
        <button
          className={`${styles.dot} ${activeIndex === 0 ? styles.dotActive : ''}`}
          onClick={() => goTo(0)}
          aria-label="Go to BlueScene"
          type="button"
        />
        <button
          className={`${styles.dot} ${activeIndex === 1 ? styles.dotActive : ''}`}
          onClick={() => goTo(1)}
          aria-label="Go to DNA Music Box"
          type="button"
        />
      </nav>
    </div>
  );
}
