'use client';

import { ArrowRight } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

export default function LandingEnterAcademyButton({ showIcon = true, dark = false }: { showIcon?: boolean; dark?: boolean }) {
  const { play } = useSound();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => { play('click'); router.push('/courses'); }}
      onMouseEnter={() => play('hover')}
      className={`${styles.fancyButton} ${styles.fancyButtonHero}`}
    >
      <span className={styles.fancyButtonInner}>
        <span className={styles.heroSlideWrap}>
          <span className={styles.heroSlideText}>Enter As Human</span>
          <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter As Human</span>
        </span>
        {showIcon && (
          <span className={styles.fancyButtonIcon} aria-hidden="true">
            <ArrowRight size={20} weight="bold" />
          </span>
        )}
      </span>
    </button>
  );
}
