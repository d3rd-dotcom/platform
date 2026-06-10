'use client';

import React from 'react';
import Image from 'next/image';
import { Sparkle, Coins, CursorClick } from '@phosphor-icons/react';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import { useSound } from '@/hooks/useSound';
import styles from './QuestSidePanel.module.css';

const BLUE_MESSAGE = 'Diamonds and rewards for completionists dedicated to self-improvement. Small steps make a difference.';

interface QuestSidePanelProps {
  isPro: boolean;
  onForge: () => void;
  onClaims: () => void;
}

export default function QuestSidePanel({
  isPro,
  onForge,
  onClaims,
}: QuestSidePanelProps) {
  const { play } = useSound();

  return (
    <div className={styles.panel}>
      <section className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.eyebrow}>Quest log</span>
          <span className={styles.versionBadge}>
            <Image src="/icons/ui-diamond.svg" alt="" width={9} height={9} />
            MWA
          </span>
        </div>
      </section>

      <BlueVideoPanel
        className={styles.blueVideo}
        message={BLUE_MESSAGE}
      />

      <div className={styles.hint}>
        <CursorClick size={16} weight="duotone" className={styles.hintIcon} />
        <span>Pick a quest from the board to see its details and claim rewards.</span>
      </div>

      {isPro && (
        <div className={styles.vipRow}>
          <button
            type="button"
            className={styles.vipBtn}
            onClick={() => { play('click'); onForge(); }}
            onMouseEnter={() => play('hover')}
          >
            <Sparkle size={12} weight="fill" />
            Quest forge
          </button>
          <button
            type="button"
            className={styles.vipBtn}
            onClick={() => { play('click'); onClaims(); }}
            onMouseEnter={() => play('hover')}
          >
            <Coins size={12} weight="fill" />
            Claims
          </button>
        </div>
      )}
    </div>
  );
}
