'use client';

import { useRouter } from 'next/navigation';
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
        <span className={styles.heroSlideText}>Enter The Academy</span>
        <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter The Academy</span>
      </span>
    </button>
  );
}
