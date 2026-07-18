'use client';

import { useCallback, useRef } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './CommunityCardCarousel.module.css';

type CommunityCard = {
  title: string;
  caption: string;
  image: string;
  tone: 'brand' | 'action' | 'deep' | 'accent' | 'night';
};

const cards: CommunityCard[] = [
  {
    title: 'Start where you are',
    caption: 'A study path mapped to what you already know.',
    image: '/images/blueastro.png',
    tone: 'brand',
  },
  {
    title: 'Field notes, every day',
    caption: 'Short daily writing that turns reading into memory.',
    image: '/images/materials/pen.png',
    tone: 'action',
  },
  {
    title: 'Peers read your work',
    caption: 'Honest feedback from people moving with you.',
    image: '/images/blue-fullbody.png',
    tone: 'accent',
  },
  {
    title: 'Progress that compounds',
    caption: 'Watch the map fill in, week over week.',
    image: '/images/egg.png',
    tone: 'deep',
  },
  {
    title: 'Missions worth finishing',
    caption: 'Each one leaves you with something real to keep.',
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
            <div className={styles.media} aria-hidden="true">
              <Image
                src={card.image}
                alt=""
                width={640}
                height={640}
                sizes="(max-width: 720px) 78vw, 300px"
                className={styles.mediaImage}
              />
            </div>
            <div className={styles.body}>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardCaption}>{card.caption}</p>
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
