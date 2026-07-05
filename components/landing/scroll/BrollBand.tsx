'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './BrollBand.module.css';

type Tone = 'indigo' | 'teal' | 'amber' | 'dawn';

interface BrollBandProps {
  src: string;
  tone: Tone;
  eyebrow: string;
  title: string;
  pin?: boolean;
}

const toneClass: Record<Tone, string> = {
  indigo: styles.toneIndigo,
  teal: styles.toneTeal,
  amber: styles.toneAmber,
  dawn: styles.toneDawn,
};

// Full-bleed cinematic band between story acts. The clip only loads once the
// band nears the viewport, plays while visible, and falls back to the tone
// gradient if the asset is missing or reduced motion is requested.
export function BrollBand({ src, tone, eyebrow, title, pin }: BrollBandProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const [videoOk, setVideoOk] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVideoOk(false);
      return;
    }

    const band = bandRef.current;
    const video = videoRef.current;
    if (!band || !video) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!video.src) video.src = src;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: '50% 0px' }
    );

    observer.observe(band);
    return () => observer.disconnect();
  }, [src]);

  return (
    <div
      ref={bandRef}
      className={`${styles.band} ${toneClass[tone]}`}
      {...(pin ? { 'data-band-pin': true } : {})}
    >
      <div className={styles.media} data-band-media>
        {videoOk && (
          <video
            ref={videoRef}
            className={`${styles.video} ${loaded ? styles.videoLoaded : ''}`}
            muted
            loop
            playsInline
            preload="none"
            onCanPlay={() => setLoaded(true)}
            onError={() => setVideoOk(false)}
          />
        )}
      </div>
      <div className={styles.scrim} />
      <div className={styles.card}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 className={styles.title}>{title}</h2>
      </div>
    </div>
  );
}

export default BrollBand;
