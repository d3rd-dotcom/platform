'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

export default function LandingEnterAcademyButton({ showIcon = true, dark = false }: { showIcon?: boolean; dark?: boolean }) {
  const router = useRouter();
  const { play } = useSound();

  const handleEnterAcademy = () => {
    play('click');
    router.push('/home');
  };

  return (
    <button
      type="button"
      onClick={handleEnterAcademy}
      onMouseEnter={() => play('hover')}
      className={`${styles.fancyButton}${dark ? ` ${styles.fancyButtonAgent}` : ''}`}
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
  );
}
