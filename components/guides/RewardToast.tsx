'use client';

import { useEffect } from 'react';
import styles from './RewardToast.module.css';

export interface RewardToastProps {
  diamonds: number;
  levelCleared: boolean;
  walkthroughComplete: boolean;
  spinGranted: boolean;
  /** Called when the toast's auto-dismiss timer elapses. */
  onDone: () => void;
}

const AUTO_DISMISS_MS = 4200;

/**
 * Presentational diamond-payout toast. Purely visual — it renders the reward
 * result from awardGuideRewards and self-dismisses via onDone. Wiring lives in
 * GuideWalkthrough (owned by the reviewer).
 */
export default function RewardToast({
  diamonds,
  levelCleared,
  walkthroughComplete,
  spinGranted,
  onDone,
}: RewardToastProps) {
  useEffect(() => {
    const timer = setTimeout(onDone, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className={styles.toast} role="status" aria-live="polite">
      <div className={styles.diamondRow}>
        <span className={styles.diamondIcon} aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <path
              d="M6 3h12l4 6-10 12L2 9l4-6Z"
              fill="currentColor"
              opacity="0.9"
            />
            <path d="M2 9h20M9 3 7 9l5 12M15 3l2 6-5 12" stroke="var(--color-surface-base)" strokeWidth="1" opacity="0.5" />
          </svg>
        </span>
        <span className={styles.diamondCount}>+{diamonds}</span>
        <span className={styles.diamondLabel}>Diamonds</span>
      </div>

      {(levelCleared || walkthroughComplete || spinGranted) && (
        <ul className={styles.bonusList}>
          {levelCleared && !walkthroughComplete && (
            <li className={styles.bonus}>
              <span className={styles.bonusDot} aria-hidden="true" />
              Level cleared — 3x bonus
            </li>
          )}
          {walkthroughComplete && (
            <li className={styles.bonusStrong}>
              <span className={styles.bonusDot} aria-hidden="true" />
              Walkthrough complete — 10x bonus
            </li>
          )}
          {spinGranted && (
            <li className={styles.bonus}>
              <span className={styles.bonusDot} aria-hidden="true" />
              Free loot-box spin granted
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
