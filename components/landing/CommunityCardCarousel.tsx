'use client';

import { useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './CommunityCardCarousel.module.css';

type CommunityCard = {
  title: string;
  image: string;
  tone: 'brand' | 'action' | 'deep' | 'accent' | 'night';
  fit?: 'cover';
};

const cards: CommunityCard[] = [
  {
    title: 'Start where you are',
    image: '/images/blueastro.png',
    tone: 'brand',
  },
  {
    title: 'Field notes, every day',
    image: '/images/a.png',
    tone: 'action',
  },
  {
    title: 'Peers read your work',
    image: '/images/course-panel-blue-art.png',
    tone: 'accent',
    fit: 'cover',
  },
  {
    title: 'Progress that compounds',
    image: '/images/egg.png',
    tone: 'deep',
  },
  {
    title: 'Missions worth finishing',
    image: '/images/treasury.png',
    tone: 'night',
  },
];

export default function CommunityCardCarousel() {
  const { play } = useSound();
  const trackRef = useRef<HTMLUListElement>(null);

  const scrollByCards = useCallback((direction: 1 | -1) => {
    const track = trackRef.current;
    if (!track) return;
    const firstCard = track.querySelector<HTMLElement>('[data-card]');
    const step = firstCard ? firstCard.offsetWidth + 16 : track.clientWidth * 0.8;
    track.scrollBy({ left: step * direction, behavior: 'smooth' });
  }, []);

  return (
    <div className={styles.carousel}>
      <ul
        ref={trackRef}
        className={styles.track}
        aria-label="What learners get at Mental Wealth Academy"
      >
        {cards.map((card) => (
          <li
            key={card.title}
            data-card
            data-tone={card.tone}
            className={styles.card}
          >
            <div
              className={`${styles.media} ${card.fit === 'cover' ? styles.mediaCoverWrap : ''}`}
              aria-hidden="true"
            >
              <Image
                src={card.image}
                alt=""
                width={640}
                height={640}
                sizes="(max-width: 720px) 78vw, 300px"
                className={card.fit === 'cover' ? styles.mediaCover : styles.mediaImage}
              />
            </div>
            <div className={styles.body}>
              <h3 className={styles.cardTitle}>{card.title}</h3>
            </div>
          </li>
        ))}
      </ul>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Previous cards"
          onMouseEnter={() => play('hover')}
          onClick={() => {
            play('click');
            scrollByCards(-1);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.arrowIcon}>
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className={styles.arrow}
          aria-label="Next cards"
          onMouseEnter={() => play('hover')}
          onClick={() => {
            play('click');
            scrollByCards(1);
          }}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className={styles.arrowIcon}>
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
