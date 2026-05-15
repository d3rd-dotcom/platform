'use client';

import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import styles from './LandingHeader.module.css';

export function LandingAuthButtons() {
  const router = useRouter();
  const { play } = useSound();

  const handleJoinNow = () => {
    play('click');
    router.push('/home');
  };

  return (
    <>
      <a
        href="https://discord.gg/ZTRVCYwncs"
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => play('hover')}
        onClick={() => play('click')}
        className={styles.discordButton}
      >
        <span className={styles.slideWrap}>
          <span className={styles.slideText}>Discord</span>
          <span className={`${styles.slideText} ${styles.slideClone}`}>Discord</span>
        </span>
      </a>
      <button
        type="button"
        onClick={handleJoinNow}
        onMouseEnter={() => play('hover')}
        className={styles.joinButton}
      >
        <span className={styles.slideWrap}>
          <span className={styles.slideText}>Apply to Join</span>
          <span className={`${styles.slideText} ${styles.slideClone}`}>Apply to Join</span>
        </span>
      </button>
    </>
  );
}
