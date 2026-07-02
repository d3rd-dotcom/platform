'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './DiamondReward.module.css';

/**
 * The diamond reward pop-up: Blue hands you your diamonds with a short note.
 * Shown on course task completes, week seals, field notes, and quest rewards.
 */

const BLUE_MESSAGES = [
  'Logged it. You are my favorite data point today.',
  'Peer reviewed: approved. Obviously.',
  'Filed under: excellent work.',
  'Results replicated. You are actually good at this.',
  'The lab notebook remembers this forever. So do I.',
  'Adding this to your permanent record. The good one.',
  'I checked twice. Still impressive.',
  'Quietly telling everyone in the lab about this.',
];

interface DiamondRewardProps {
  amount: number;
  onComplete?: () => void;
}

export const DiamondReward: React.FC<DiamondRewardProps> = ({ amount, onComplete }) => {
  const { play } = useSound();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayAmount, setDisplayAmount] = useState(0);
  const frameRef = useRef<number | null>(null);

  const message = useMemo(
    () => BLUE_MESSAGES[Math.floor(Math.random() * BLUE_MESSAGES.length)],
    [],
  );

  useEffect(() => {
    setIsAnimating(true);
    play('celebration');
    setDisplayAmount(0);

    const earnedDuration = 900;
    const outroDelay = 1400;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - start;
      const earnedProgress = Math.min(elapsed / earnedDuration, 1);
      setDisplayAmount(Math.round(amount * easeOutCubic(earnedProgress)));

      if (earnedProgress === 1) {
        window.setTimeout(() => {
          setIsAnimating(false);
          onComplete?.();
        }, outroDelay);
        return;
      }

      frameRef.current = window.requestAnimationFrame(animate);
    };

    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [amount, onComplete, play]);

  if (!isAnimating) return null;

  return (
    <div className={styles.diamondReward}>
      <div className={styles.bubble}>
        <div className={styles.blueAvatar}>
          <Image
            src="/blue/blue-home.png"
            alt="Blue"
            width={64}
            height={64}
            className={styles.blueAvatarImg}
          />
          <span className={styles.diamondBadge}>
            <Image src="/icons/ui-diamond.svg" alt="" width={20} height={20} />
          </span>
        </div>
        <div className={styles.text}>
          <div className={styles.amount}>+{displayAmount}</div>
          <div className={styles.subtext}>Diamonds earned!</div>
          <div className={styles.blueMessage}>{message}</div>
        </div>
      </div>
    </div>
  );
};

export default DiamondReward;
