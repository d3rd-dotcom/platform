'use client';

import React from 'react';
import Image from 'next/image';
import { CursorClick } from '@phosphor-icons/react';
import BlueVideoPanel from '@/components/blue-video-panel/BlueVideoPanel';
import styles from './QuestSidePanel.module.css';

const BLUE_MESSAGE = 'Completionists: small steps move you forward.';

export default function QuestSidePanel() {
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
    </div>
  );
}
