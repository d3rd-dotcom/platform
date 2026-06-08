'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Button from '@/components/button/Button';
import { getTestShardReward, TEST_DIFFICULTY_MAX, TEST_DIFFICULTY_MIN } from '@/lib/test-rewards';
import styles from './SurveyController.module.css';

const OPTION_COLORS = ['#5168ff', '#8b5cf6', '#2dd4bf', '#34d399'];

const SURVEY_TYPES = [
  { id: 'via-character-strengths', label: 'Character Strengths', sub: '240-item VIA inventory' },
  { id: 'big-five', label: 'Big Five Personality', sub: 'Validated OCEAN model' },
  { id: 'moral-foundations', label: 'Moral Foundations', sub: "Haidt's 5-foundation model" },
  { id: 'attachment-style', label: 'Attachment Style', sub: 'Secure, anxious, or avoidant' },
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
  characterImageSrc = '/videos/bluehome.mp4',
  characterPosterSrc,
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
  const [shouldLoadVideo, setShouldLoadVideo] = useState(!deferVideo);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const imagePanelRef = useRef<HTMLDivElement>(null);
  const shardReward = getTestShardReward(difficulty);

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
  }, [characterImageSrc]);

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
        <span className={styles.heroVersion}>
          <Image src="/icons/ui-shard.svg" alt="" width={10} height={10} className={styles.shardIcon} />
          {version}
        </span>
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
            Pick something. Answer it. I'll try to figure out what it means before you do. If I win, I'll give you some diamonds.
          </p>
        </div>
      </div>

      {/* Survey type selector */}
      <div className={styles.persona}>
        <span className={styles.eyebrow}>Survey type</span>
        <ul className={styles.surveyList} role="listbox">
          {SURVEY_TYPES.map((survey, i) => (
            <li
              key={survey.id}
              role="option"
              aria-selected={survey.id === selectedSurvey.id}
              className={`${styles.surveyItem} ${survey.id === selectedSurvey.id ? styles.surveyItemActive : ''}`}
              style={{ '--accent': OPTION_COLORS[i] } as React.CSSProperties}
              onClick={() => handleSelectSurvey(survey)}
            >
              <span className={styles.surveyItemLabel}>{survey.label}</span>
              <span className={styles.surveyItemSub}>{survey.sub}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Difficulty scale */}
      {showDifficulty && (
        <section className={styles.scaleCard}>
          <div className={styles.row}>
            <span className={styles.eyebrow}>Test scale</span>
            <div className={styles.shardBadge} aria-label={`${shardReward} diamonds earned for this test`}>
              <Image src="/icons/ui-shard.svg" alt="" width={14} height={14} className={styles.shardIcon} />
              +{shardReward} diamonds
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

      <Button fullWidth onClick={onStartSurvey ?? onSignForm} className={styles.cta}>
        {ctaLabel}
      </Button>
    </div>
  );
}
