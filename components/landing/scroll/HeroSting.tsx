'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './HeroSting.module.css';

// The 5s arrival clip behind the hero headline. Screen-blended over the indigo
// canvas so it reads as light, not a boxed video. Silently absent if the asset
// hasn't landed or the visitor prefers reduced motion.
export function HeroSting() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVideoOk(false);
      return;
    }
    videoRef.current?.play().catch(() => {});
  }, []);

  if (!videoOk) return null;

  return (
    <div className={styles.sting} aria-hidden="true">
      <video
        ref={videoRef}
        className={`${styles.video} ${loaded ? styles.videoLoaded : ''}`}
        src="/landing/broll/hero-sting.mp4"
        muted
        loop
        playsInline
        autoPlay
        preload="metadata"
        onCanPlay={() => setLoaded(true)}
        onError={() => setVideoOk(false)}
      />
      <div className={styles.scrim} />
    </div>
  );
}

export default HeroSting;
