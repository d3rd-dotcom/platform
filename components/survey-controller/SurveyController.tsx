'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { getTestShardReward, TEST_DIFFICULTY_MAX, TEST_DIFFICULTY_MIN } from '@/lib/test-rewards';
import styles from './SurveyController.module.css';

const SURVEY_TYPES = [
  { id: 'via-character-strengths', label: 'Via Character Quiz', sub: '240-item strengths inventory' },
  { id: 'daemon-analysis', label: 'Decision Pattern Analysis', sub: 'Decision-making under pressure' },
  { id: 'political-alignment', label: 'Political Alignment', sub: 'Agency, responsibility, and change' },
  { id: 'archetype', label: 'Mystic Archetype', sub: 'Narrative pattern mapping' },
] as const;

type SurveyType = (typeof SURVEY_TYPES)[number];

function getSurveyTypeById(id?: string): SurveyType {
  return SURVEY_TYPES.find((survey) => survey.id === id) ?? SURVEY_TYPES[0];
}

interface SurveyControllerProps {
  userName?: string;
  version?: string;
  characterImageSrc?: string;
  characterPosterSrc?: string;
  deferVideo?: boolean;
  difficulty?: number;
  showDifficulty?: boolean;
  ctaLabel?: string;
  onSignForm?: () => void;
  onStartSurvey?: () => void;
  onDifficultyChange?: (value: number) => void;
  selectedSurveyId?: string;
  onSurveyTypeChange?: (surveyId: string) => void;
}

export default function SurveyController({
  userName = 'Welcome',
  version = 'V.e1-MWA36B',
  characterImageSrc = '/uploads/blueavatar.mp4',
  characterPosterSrc = '/uploads/blue-landing-avatar.png',
  deferVideo = true,
  difficulty: initialDifficulty = 101,
  showDifficulty = true,
  ctaLabel = 'Sign form to begin',
  onSignForm,
  onStartSurvey,
  onDifficultyChange,
  selectedSurveyId,
  onSurveyTypeChange,
}: SurveyControllerProps) {
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [selectedSurvey, setSelectedSurvey] = useState<SurveyType>(() => getSurveyTypeById(selectedSurveyId));
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
  }, [characterImageSrc, selectedSurvey.id]);

  useEffect(() => {
    setSelectedSurvey(getSurveyTypeById(selectedSurveyId));
  }, [selectedSurveyId]);

  const handleDifficultyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setDifficulty(value);
    onDifficultyChange?.(value);
  };

  const handleSelectSurvey = (survey: SurveyType) => {
    setSelectedSurvey(survey);
    setIsOpen(false);
    onSurveyTypeChange?.(survey.id);
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
          <div className={styles.videoReviewEyebrow}>{selectedSurvey.label} · review</div>
          <p className={styles.videoReviewText}>
            I will read every answer and score this attempt. Pick your survey type, answer honestly, and we begin.
          </p>
        </div>
      </div>

      {/* Survey type selector */}
      <div className={styles.persona}>
        <span className={styles.eyebrow}>Survey type</span>
        <div className={styles.dropdownOuter} ref={dropdownRef}>
          <button
            type="button"
            className={styles.dropdownInner}
            onClick={() => setIsOpen(o => !o)}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
          >
            <span className={styles.dropdownText}>{selectedSurvey.label}</span>
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
              {SURVEY_TYPES.map(survey => (
                <li
                  key={survey.id}
                  role="option"
                  aria-selected={survey.id === selectedSurvey.id}
                  className={`${styles.dropdownItem} ${survey.id === selectedSurvey.id ? styles.dropdownItemActive : ''}`}
                  onClick={() => handleSelectSurvey(survey)}
                >
                  <span className={styles.dropdownItemLabel}>{survey.label}</span>
                  <span className={styles.dropdownItemSub}>{survey.sub}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Difficulty scale */}
      {showDifficulty && (
        <section className={styles.scaleCard}>
          <div className={styles.row}>
            <span className={styles.eyebrow}>Test scale</span>
            <div className={styles.shardBadge} aria-label={`${shardReward} credits earned for this test`}>
              <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} className={styles.shardIcon} />
              +{shardReward} credits
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
            Higher difficulty means harder questions and a larger credit payout.
          </p>
        </section>
      )}

      <button className={styles.cta} onClick={onStartSurvey ?? onSignForm} type="button">
        {ctaLabel}
      </button>
    </div>
  );
}
