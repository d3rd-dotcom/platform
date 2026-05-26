'use client';

import { useRouter } from 'next/navigation';
import { ArrowRight } from '@phosphor-icons/react';
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
      className={styles.heroButton}
    >
      <span className={styles.heroSlideWrap}>
        <span className={styles.heroSlideText}>Enter</span>
        <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter</span>
      </span>
      <span className={styles.heroButtonArrow} aria-hidden="true">
        <ArrowRight size={22} weight="bold" />
      </span>
    </button>
  );
}
