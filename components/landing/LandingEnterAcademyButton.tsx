'use client';

import { useRouter } from 'next/navigation';
import { Gift } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

export default function LandingEnterAcademyButton() {
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
      className={styles.fancyButton}
    >
      <span className={styles.fancyButtonInner}>
        <span className={styles.heroSlideWrap}>
          <span className={styles.heroSlideText}>Enter Academy</span>
          <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter Academy</span>
        </span>
        <span className={styles.fancyButtonIcon} aria-hidden="true">
          <Gift size={20} weight="regular" />
        </span>
      </span>
    </button>
  );
}
