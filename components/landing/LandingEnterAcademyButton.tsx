'use client';

import { useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import { RoleGatePopup } from './RoleGatePopup';
import styles from './LandingPage.module.css';

export default function LandingEnterAcademyButton({ showIcon = true, dark = false }: { showIcon?: boolean; dark?: boolean }) {
  const { play } = useSound();
  const [showGate, setShowGate] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => { play('click'); setShowGate(true); }}
        onMouseEnter={() => play('hover')}
        className={`${styles.fancyButton} ${styles.fancyButtonHero}`}
      >
        <span className={styles.fancyButtonInner}>
          <span className={styles.heroSlideWrap}>
            <span className={styles.heroSlideText}>Enter The Academy</span>
            <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter The Academy</span>
          </span>
          {showIcon && (
            <span className={styles.fancyButtonIcon} aria-hidden="true">
              <ArrowRight size={20} weight="bold" />
            </span>
          )}
        </span>
      </button>

      <RoleGatePopup isOpen={showGate} onClose={() => setShowGate(false)} />
    </>
  );
}
