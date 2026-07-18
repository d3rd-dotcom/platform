'use client';

import { useCallback, useRef, type PointerEvent } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './CommunityCardCarousel.module.css';

type CommunityCard = {
  title: string;
  description: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  presentation?: 'book' | 'phones' | 'animes' | 'dinosaur';
  reflection?: boolean;
  tone: 'brand' | 'action' | 'deep' | 'accent' | 'night';
  fit?: 'cover';
};

const cards: CommunityCard[] = [
  {
    title: 'Start where you are',
    description: 'Choose one clear next step and build momentum from there.',
    image: '/images/community-book.png',
    imageWidth: 784,
    imageHeight: 1000,
    presentation: 'book',
    tone: 'brand',
  },
  {
    title: 'Field notes, every day',
    description: 'Capture what you notice so each lesson becomes part of your practice.',
    image: '/images/community-phones.png',
    imageWidth: 1000,
    imageHeight: 873,
    presentation: 'phones',
    tone: 'action',
  },
  {
    title: 'Peers read your work',
    description: 'Share your thinking, receive useful feedback, and learn through exchange.',
    image: '/images/community-animes.png',
    imageWidth: 1000,
    imageHeight: 801,
    presentation: 'animes',
    tone: 'accent',
  },
  {
    title: 'Progress that compounds',
    description: 'Connect small lessons over time and make your progress visible.',
    image: '/images/community-dinosaur.png',
    imageWidth: 1000,
    imageHeight: 800,
    presentation: 'dinosaur',
    reflection: true,
    tone: 'deep',
  },
  {
    title: 'Missions worth finishing',
    description: 'Turn ideas into focused work with a clear outcome at the end.',
    image: '/images/treasury.png',
    imageWidth: 640,
    imageHeight: 640,
    tone: 'night',
  },
];

export default function CommunityCardCarousel() {
  const { play } = useSound();
  const trackRef = useRef<HTMLUListElement>(null);

  const handleCardPointerMove = useCallback(
    (event: PointerEvent<HTMLLIElement>) => {
      if (event.pointerType === 'touch') return;

      const card = event.currentTarget;
      const bounds = card.getBoundingClientRect();
      const horizontalPosition = (event.clientX - bounds.left) / bounds.width;
      const verticalPosition = (event.clientY - bounds.top) / bounds.height;
      const rotateX = (0.5 - verticalPosition) * 10;
      const rotateY = (horizontalPosition - 0.5) * 10;

      card.dataset.tiltActive = 'true';
      card.style.setProperty('--card-rotate-x', `${rotateX.toFixed(2)}deg`);
      card.style.setProperty('--card-rotate-y', `${rotateY.toFixed(2)}deg`);
    },
    []
  );

  const handleCardPointerLeave = useCallback(
    (event: PointerEvent<HTMLLIElement>) => {
      delete event.currentTarget.dataset.tiltActive;
      event.currentTarget.style.setProperty('--card-rotate-x', '0deg');
      event.currentTarget.style.setProperty('--card-rotate-y', '0deg');
    },
    []
  );

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
            data-presentation={card.presentation}
            className={styles.card}
            onPointerMove={handleCardPointerMove}
            onPointerLeave={handleCardPointerLeave}
          >
            <div
              className={`${styles.media} ${card.fit === 'cover' ? styles.mediaCoverWrap : ''}`}
              aria-hidden="true"
            >
              <Image
                src={card.image}
                alt=""
                width={card.imageWidth}
                height={card.imageHeight}
                sizes="350px"
                className={card.fit === 'cover' ? styles.mediaCover : styles.mediaImage}
              />
              {card.reflection && (
                <Image
                  src={card.image}
                  alt=""
                  width={card.imageWidth}
                  height={card.imageHeight}
                  sizes="350px"
                  className={styles.reflectionImage}
                />
              )}
            </div>
            <div className={styles.body}>
              <h3 className={styles.cardTitle}>{card.title}</h3>
              <p className={styles.cardDescription}>{card.description}</p>
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
