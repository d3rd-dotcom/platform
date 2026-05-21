'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './ShardAnimation.module.css';

interface ShardAnimationProps {
  shards: number;
  onComplete?: () => void;
}

export const ShardAnimation: React.FC<ShardAnimationProps> = ({ shards, onComplete }) => {
  const { play } = useSound();
  const [isAnimating, setIsAnimating] = useState(false);
  const [displayShards, setDisplayShards] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    setIsAnimating(true);
    play('celebration');
    setDisplayShards(0);

    const earnedDuration = 900;
    const outroDelay = 620;
    const start = performance.now();

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    const animate = (now: number) => {
      const elapsed = now - start;
      const earnedProgress = Math.min(elapsed / earnedDuration, 1);
      setDisplayShards(Math.round(shards * easeOutCubic(earnedProgress)));

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
  }, [shards, onComplete, play]);

  if (!isAnimating) return null;

  return (
    <div className={styles.shardAnimation}>
      <div className={styles.shardBubble}>
        <div className={styles.shardIconContainer}>
          <Image
            src="/icons/ui-shard.svg"
            alt="Gem"
            width={48}
            height={48}
            className={styles.shardIcon}
          />
        </div>
        <div className={styles.shardText}>
          <div className={styles.shardLabel}>+{displayShards}</div>
          <div className={styles.shardSubtext}>Gems Earned!</div>
        </div>
      </div>
    </div>
  );
};
