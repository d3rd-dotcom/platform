'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { getTestShardReward, TEST_DIFFICULTY_MAX, TEST_DIFFICULTY_MIN } from '@/lib/test-rewards';
import styles from './SurveyController.module.css';

const PERSONAS = [
  { id: 'B.L.U.E.',        label: 'B.L.U.E.',        sub: 'Default researcher' },
  { id: 'The Strategist',   label: 'The Strategist',   sub: 'Competitive & analytical' },
  { id: 'The Counselor',    label: 'The Counselor',    sub: 'Reflective & emotional' },
  { id: 'The Observer',     label: 'The Observer',     sub: 'Detached & scientific' },
];

interface SurveyControllerProps {
  userName?: string;
  version?: string;
  characterImageSrc?: string;
  difficulty?: number;
  onSignForm?: () => void;
  onDifficultyChange?: (value: number) => void;
  onPersonaChange?: (persona: string) => void;
}

export default function SurveyController({
  userName = 'Welcome',
  version = 'V.e1-MWA36B',
  characterImageSrc = '/uploads/blueavatar.mp4',
  difficulty: initialDifficulty = 101,
  onSignForm,
  onDifficultyChange,
  onPersonaChange,
}: SurveyControllerProps) {
  const [difficulty, setDifficulty] = useState(initialDifficulty);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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
      <div className={styles.topWrapper}>
        <div className={styles.headerRow}>
          <span className={styles.userName}>{userName}</span>
          <span className={styles.version}>{version}</span>
        </div>
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>Character set</span>
          <span className={styles.controlLabel}>Persona</span>
        </div>

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

      <div className={styles.imagePanel}>
        <div className={styles.imageWrapper}>
          {characterImageSrc.endsWith('.mp4') ? (
            <video
              className={styles.characterVideo}
              src={characterImageSrc}
              autoPlay
              loop
              muted
              playsInline
              disablePictureInPicture
              disableRemotePlayback
              controlsList="nodownload nofullscreen noremoteplayback"
              aria-label="B.L.U.E. avatar"
            />
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
      </div>

      <div className={styles.controls}>
        <div className={styles.controlRow}>
          <span className={styles.controlLabel}>Test scale</span>
          <div className={styles.controlMetrics}>
            <span className={styles.controlLabel}>{difficulty}</span>
            <div className={styles.shardRewardBox} aria-label={`${shardReward} shards earned for this test`}>
              <Image src="/icons/ui-shard.svg" alt="" width={18} height={18} className={styles.shardIcon} />
              <div className={styles.shardRewardText}>
                <span className={styles.shardRewardValue}>+{shardReward} reward</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.scaler}>
          <div className={styles.sliderWrapper}>
            <input
              type="range"
              min={min}
              max={max}
              value={difficulty}
              onChange={handleDifficultyChange}
              className={styles.slider}
              style={{ '--progress': `${progress}%` } as React.CSSProperties}
            />
          </div>
          <p className={styles.helperText}>
            Higher difficulty means harder questions and a larger shard payout.
          </p>
        </div>

        <button className={styles.ctaButton} onClick={onSignForm} type="button">
          Sign Form To Begin
        </button>
      </div>
    </div>
  );
}
