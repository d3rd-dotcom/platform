'use client';

import { useState } from 'react';
import Link from 'next/link';
import styles from './LiveNow.module.css';

// Featured Academy broadcast. Click-to-play (facade) keeps the home page light:
// the YouTube iframe only loads after the user opts in, and never autoplays audio.
const VIDEO_ID = 'JccxSJ3twmM';

export default function LiveNow() {
  const [playing, setPlaying] = useState(false);

  return (
    <section className={styles.live} aria-label="Live now">
      <div className={styles.head}>
        <span className={styles.label}>
          <span className={styles.dot} aria-hidden="true" />
          Live now
        </span>
        <p className={styles.hint}>
          Catch the latest session, then step into the room with the cohort.
        </p>
      </div>

      <div className={styles.frame}>
        {playing ? (
          <iframe
            className={styles.video}
            src={`https://www.youtube.com/embed/${VIDEO_ID}?autoplay=1&rel=0`}
            title="Mental Wealth Academy livestream"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className={styles.poster}
            onClick={() => setPlaying(true)}
            aria-label="Play the latest session"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`}
              alt=""
              className={styles.posterImg}
              loading="lazy"
            />
            <span className={styles.scrim} aria-hidden="true" />
            <span className={styles.play} aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className={styles.foot}>
        <div className={styles.meta}>
          <h3 className={styles.title}>Academy live sessions</h3>
          <p className={styles.sub}>Expert talks, cohort check-ins, and Q&amp;A — with live chat.</p>
        </div>
        <Link href="/livestream" className={styles.cta}>
          Enter the room
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
