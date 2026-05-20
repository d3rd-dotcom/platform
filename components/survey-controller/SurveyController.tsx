'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { getTestShardReward, TEST_DIFFICULTY_MAX, TEST_DIFFICULTY_MIN } from '@/lib/test-rewards';
import styles from './SurveyController.module.css';

const PERSONAS = [
  { id: 'Blue',  label: 'Blue',  sub: 'Default researcher' },
  { id: 'Vesper',    label: 'Vesper',     sub: 'Alternative persona' },
];

interface SurveyControllerProps {
  userName?: string;
  version?: string;
  characterImageSrc?: string;
  characterPosterSrc?: string;
  deferVideo?: boolean;
  difficulty?: number;
  onSignForm?: () => void;
  onDifficultyChange?: (value: number) => void;
  onPersonaChange?: (persona: string) => void;
}

export default function SurveyController({
  userName = 'Welcome',
  version = 'V.e1-MWA36B',
  characterImageSrc = '/uploads/blueavatar.mp4',
  characterPosterSrc = '/uploads/blue-landing-avatar.png',
  deferVideo = true,
  difficulty: initialDifficulty = 101,
  onSignForm,
  onDifficultyChange,
  onPersonaChange,
}: SurveyControllerProps) {
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [isOpen, setIsOpen] = useState(false);
  const [shouldLoadVideo, setShouldLoadVideo] = useState(!deferVideo);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const imagePanelRef = useRef<HTMLDivElement>(null);
  const shardReward = getTestShardReward(difficulty);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!deferVideo || shouldLoadVideo || !characterImageSrc.endsWith('.mp4')) return;
    const el = imagePanelRef.current;
    if (!el) return;

    const load = () => {
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => setShouldLoadVideo(true), { timeout: 1800 });
        return;
      }
      setTimeout(() => setShouldLoadVideo(true), 900);
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
  }, [characterImageSrc, deferVideo, shouldLoadVideo]);

  useEffect(() => {
    setIsVideoReady(false);
  }, [characterImageSrc, selectedPersona.id]);

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDifficulty(value);
    onDifficultyChange?.(value);
  };

  const handleSelectPersona = (p: typeof PERSONAS[0]) => {
    setSelectedPersona(p);
    setIsOpen(false);
    onPersonaChange?.(p.id);
  };

  const min = TEST_DIFFICULTY_MIN;
  const max = TEST_DIFFICULTY_MAX;
  const progress = ((difficulty - min) / (max - min)) * 100;

  return (
    <div className={styles.controller}>
      {/* Hero */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.eyebrow}>Assessment engine</span>
          <h1 className={styles.heroTitle}>{userName}</h1>
        </div>
        <span className={styles.heroVersion}>{version}</span>
      </section>

      {/* Persona selector */}
      <div className={styles.persona}>
        <span className={styles.eyebrow}>Persona</span>
        <div className={styles.dropdownOuter} ref={dropdownRef}>
          <button
            type="button"
            className={styles.dropdownInner}
            onClick={() => setIsOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className={styles.dropdownText}>{selectedPersona.label}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={`${styles.chevronIcon} ${isOpen ? styles.chevronOpen : ''}`}
              aria-hidden="true"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {isOpen && (
            <ul className={styles.dropdownMenu} role="listbox">
              {PERSONAS.map(p => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={p.id === selectedPersona.id}
                  className={`${styles.dropdownItem} ${p.id === selectedPersona.id ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleSelectPersona(p)}
                >
                  <span className={styles.dropdownItemLabel}>{p.label}</span>
                  <span className={styles.dropdownItemSub}>{p.sub}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Character video / blue panel */}
      <div className={styles.videoPanel} ref={imagePanelRef}>
        <div className={styles.videoWrapper}>
          {characterImageSrc.endsWith('.mp4') ? (
            shouldLoadVideo ? (
              <>
                <video
                  className={`${styles.characterVideo} ${isVideoReady ? styles.characterVideoReady : ''}`}
                  src={characterImageSrc}
                  poster={characterPosterSrc}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  disablePictureInPicture
                  disableRemotePlayback
                  controlsList="nodownload nofullscreen noremoteplayback"
                  aria-label="Blue avatar"
                  onLoadedData={() => setIsVideoReady(true)}
                  onCanPlay={() => setIsVideoReady(true)}
                />
                {!isVideoReady && <div className={styles.videoLoadingShell} aria-hidden="true" />}
              </>
            ) : (
              <div className={styles.videoLoadingShell} aria-hidden="true" />
            )
          ) : characterImageSrc ? (
            <Image
              src={characterImageSrc}
              alt="Character"
              fill
              sizes="397px"
              style={{ objectFit: 'cover' }}
            />
          ) : (
            <div className={styles.imagePlaceholder} />
          )}
        </div>
        <div className={styles.videoReview}>
          <div className={styles.videoReviewEyebrow}>{selectedPersona.label} · review</div>
          <p className={styles.videoReviewText}>
            I will read every answer and score this attempt. Pick your scale, sign the form, and we begin.
          </p>
        </div>
      </div>

      {/* Difficulty scale */}
      <section className={styles.scaleCard}>
        <div className={styles.row}>
          <span className={styles.eyebrow}>Test scale</span>
          <div className={styles.shardBadge} aria-label={`${shardReward} shards earned for this test`}>
            <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} className={styles.shardIcon} />
            +{shardReward} shards
          </div>
        </div>

        <div className={styles.scaleStatRow}>
          <span className={styles.scaleStat}>{difficulty}</span>
          <span className={styles.scaleStatUnit}>difficulty</span>
        </div>

        <input
          type="range"
          min={min}
          max={max}
          value={difficulty}
          onChange={handleDifficultyChange}
          className={styles.slider}
          style={{ '--progress': `${progress}%` } as React.CSSProperties}
        />
        <p className={styles.helperText}>
          Higher difficulty means harder questions and a larger shard payout.
        </p>
      </section>

      <button className={styles.cta} onClick={onSignForm} type="button">
        Sign form to begin
      </button>
    </div>
  );
}
