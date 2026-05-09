'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

function LandingEnterAcademyButtonInner() {
  const router = useRouter();
  const { login, authenticated } = usePrivy();
  const { play } = useSound();
  const loginTriggered = useRef(false);

  useEffect(() => {
    if (!authenticated || !loginTriggered.current) return;
    loginTriggered.current = false;
    router.push('/home');
  }, [authenticated, router]);

  const handleEnterAcademy = () => {
    play('click');
    if (authenticated) {
      router.push('/home');
      return;
    }
    loginTriggered.current = true;
    login();
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

export default function LandingEnterAcademyButton() {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#5168FF',
        },
        loginMethods: ['wallet', 'email', 'farcaster'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <LandingEnterAcademyButtonInner />
    </PrivyProvider>
  );
}
