'use client';

import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import styles from './LandingHeader.module.css';

export function LandingAuthButtons() {
  const router = useRouter();
  const { play } = useSound();

  const handleLogin = () => {
    router.push('/home');
  };

  const handleJoinNow = () => {
    router.push('/home');
  };

  return (
    <>
      <button
        type="button"
        onClick={handleLogin}
        onMouseEnter={() => play('hover')}
        className={styles.loginButton}
      >
        <span className={styles.slideWrap}>
          <span className={styles.slideText}>Login</span>
          <span className={`${styles.slideText} ${styles.slideClone}`}>Login</span>
        </span>
      </button>
      <button
        type="button"
        onClick={handleJoinNow}
        onMouseEnter={() => play('hover')}
        className={styles.joinButton}
      >
        <span className={styles.slideWrap}>
          <span className={styles.slideText}>Join Now</span>
          <span className={`${styles.slideText} ${styles.slideClone}`}>Join Now</span>
        </span>
      </button>
    </>
  );
}
