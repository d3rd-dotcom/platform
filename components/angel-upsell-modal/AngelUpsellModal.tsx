'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect } from 'react';
import { useSound } from '@/hooks/useSound';
import styles from './AngelUpsellModal.module.css';

interface AngelUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Hands off to the Scatter mint flow (MintModal). */
  onMint: () => void;
}

const ANGEL_IMAGE = 'https://i.imgur.com/GXA3DBV.gif';

const FEATURES = [
  'Get paid for every quest you complete',
  'Gain access to private events',
  'A quiet virtue, made visible',
];

export default function AngelUpsellModal({ isOpen, onClose, onMint }: AngelUpsellModalProps) {
  const { play } = useSound();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <div className={styles.content}>
          <div className={styles.topSection}>
            <div className={styles.imageWrapper}>
              <img src={ANGEL_IMAGE} alt="Academic Angel" className={styles.angelImage} />
            </div>

            <div className={styles.textContent}>
              <span className={styles.badge}>Exclusive Membership</span>
              <h2 className={styles.title}>Become an Academic Angel</h2>
              <p className={styles.description}>
                You feel the sky glow, you understand it now.
              </p>
              <ul className={styles.featureList}>
                {FEATURES.map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    <svg
                      className={styles.checkIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M13.5 4.5L6.5 11.5L2.5 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <button
            type="button"
            className={styles.ctaButton}
            onClick={() => { play('click'); onMint(); }}
            onMouseEnter={() => play('hover')}
          >
            <span>Mint your Angel</span>
          </button>
        </div>
      </div>
    </div>
  );
}
