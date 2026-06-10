'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Sparkle, Coins, Info, CursorClick } from '@phosphor-icons/react';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import { useSound } from '@/hooks/useSound';
import styles from './QuestSidePanel.module.css';

const MSG_DEFAULT = 'Diamonds and rewards for completionists dedicated to self-improvement. Small steps make a difference.';
const MSG_USDC = '$1 USDC per quest, paid on-chain to your wallet. Academic Angels only — hold the NFT on Base to unlock.';

interface QuestSidePanelProps {
  completedCount: number;
  totalCount: number;
  usdcAvailable: number;
  isPro: boolean;
  onForge: () => void;
  onClaims: () => void;
}

export default function QuestSidePanel({
  completedCount,
  totalCount,
  usdcAvailable,
  isPro,
  onForge,
  onClaims,
}: QuestSidePanelProps) {
  const { play } = useSound();
  const [blueMessage, setBlueMessage] = useState(MSG_DEFAULT);
  const usdcInfoActive = blueMessage === MSG_USDC;

  const handleUsdcInfo = () => {
    play('click');
    setBlueMessage(usdcInfoActive ? MSG_DEFAULT : MSG_USDC);
  };

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
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Cleared</span>
            <span className={styles.statValue}>
              <Image src="/icons/money.svg" alt="" width={13} height={13} className={styles.statIcon} />
              {completedCount}
              <span className={styles.statMuted}>/{totalCount}</span>
            </span>
          </div>
          {usdcAvailable > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabelRow}>
                <span className={styles.statLabel}>USDC bounties</span>
                <button
                  type="button"
                  className={`${styles.infoBtn} ${usdcInfoActive ? styles.infoBtnActive : ''}`}
                  onClick={handleUsdcInfo}
                  aria-label="What are USDC bounties?"
                  title="What are USDC bounties?"
                >
                  <Info size={11} weight="fill" />
                </button>
              </span>
              <span className={styles.statValue}>
                <Image src="/icons/usdc-logo.svg" alt="USDC" width={14} height={14} />
                ${usdcAvailable}
              </span>
            </div>
          )}
        </div>
      </section>

      <BlueVideoPanel
        className={styles.blueVideo}
        message={blueMessage}
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
