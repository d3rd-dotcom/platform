'use client';

import { useRouter } from 'next/navigation';
import { Robot } from '@phosphor-icons/react';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

export default function LandingEnterAsAgentButton() {
  const router = useRouter();
  const { play } = useSound();

  const handleEnterAsAgent = () => {
    play('click');
    router.push('/agents');
  };

  return (
    <button
      type="button"
      onClick={handleEnterAsAgent}
      onMouseEnter={() => play('hover')}
      className={`${styles.fancyButton} ${styles.fancyButtonAgent}`}
    >
      <span className={styles.fancyButtonInner}>
        <span className={styles.heroSlideWrap}>
          <span className={styles.heroSlideText}>Enter As Agent</span>
          <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter As Agent</span>
        </span>
        <span className={styles.fancyButtonIcon} aria-hidden="true">
          <Robot size={20} weight="regular" />
        </span>
      </span>
    </button>
  );
}
