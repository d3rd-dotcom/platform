'use client';

import React, { useEffect, useRef } from 'react';
import { Phone } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './BlueCallingOverlay.module.css';

interface BlueCallingOverlayProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function BlueCallingOverlay({ onAccept, onDecline }: BlueCallingOverlayProps) {
  const { play } = useSound();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDecline();
    };
    window.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    // Start ringing
    play('ring');
    intervalRef.current = setInterval(() => play('ring'), 2400);

    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onDecline, play]);

  return (
    <div className={styles.backdrop} onClick={onDecline}>
      <div className={styles.card} onClick={(e) => e.stopPropagation()}>
        <div className={styles.avatarCircle}>
          <Phone size={40} weight="fill" />
        </div>

        <div className={styles.nameRow}>
          <span className={styles.name}>Blue</span>
        </div>
        <span className={styles.callingText}>is calling...</span>

        <div className={styles.buttons}>
          <button className={styles.declineBtn} onClick={onDecline} type="button">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M22 2L2 22M2 2l20 20" />
            </svg>
          </button>
          <button className={styles.acceptBtn} onClick={onAccept} type="button">
            <Phone size={28} weight="fill" />
          </button>
        </div>
      </div>
    </div>
  );
}
