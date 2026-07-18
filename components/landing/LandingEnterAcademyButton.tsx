'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useSound } from '@/hooks/useSound';
import styles from './LandingPage.module.css';

export default function LandingEnterAcademyButton({ showIcon = true, dark = false }: { showIcon?: boolean; dark?: boolean }) {
  const { play } = useSound();
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => { play('click'); router.push('/dao'); }}
      onMouseEnter={() => play('hover')}
      className={`${styles.fancyButton} ${styles.fancyButtonHero}`}
    >
      <span className={styles.fancyButtonInner}>
        {showIcon && (
          <span className={styles.fancyButtonIcon} aria-hidden="true">
            <Image
              src="/icons/nav-world-v2.svg"
              alt=""
              width={18}
              height={18}
              className={styles.fancyButtonWorldIcon}
            />
          </span>
        )}
        <span className={styles.heroSlideWrap}>
          <span className={styles.heroSlideText}>Enter Academy</span>
          <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Enter Academy</span>
        </span>
      </span>
    </button>
  );
}
