'use client';

import React from 'react';
import Link from 'next/link';
import styles from './BlueChat.module.css';
import type { GuideRecommendCard } from '@/lib/guide-api-schemas';

const MAX_PREREQ_CHIPS = 3;

interface GuideCardsInlineProps {
  cards: GuideRecommendCard[];
  /** Called when the user follows a card link, so the chat overlay can close. */
  onNavigate?: () => void;
}

/**
 * Small knowledge-node cards Blue drops into the chat: the guide, a one-line
 * summary, and the prereqs still standing between the user and it. Links land
 * on the guide page (the DAG node), prereq chips on theirs.
 */
const GuideCardsInline: React.FC<GuideCardsInlineProps> = ({ cards, onNavigate }) => (
  <div className={styles.guideCards}>
    {cards.map((card) => {
      const hiddenPrereqs = card.prereqs.length - MAX_PREREQ_CHIPS;
      const badgeClass = card.completed
        ? styles.guideCardBadgeDone
        : card.ready
          ? styles.guideCardBadgeReady
          : styles.guideCardBadgeLocked;
      const badgeText = card.completed
        ? 'done'
        : card.ready
          ? 'ready now'
          : `${card.prereqs.length} step${card.prereqs.length === 1 ? '' : 's'} away`;
      return (
        <div key={card.id} className={styles.guideCard}>
          <div className={styles.guideCardHead}>
            <Link
              href={`/home/guides/${card.slug}`}
              className={styles.guideCardTitle}
              onClick={onNavigate}
            >
              {card.topicTitle}
            </Link>
            <span className={`${styles.guideCardBadge} ${badgeClass}`}>{badgeText}</span>
          </div>
          {card.summary && <p className={styles.guideCardSummary}>{card.summary}</p>}
          <div className={styles.guideCardFoot}>
            {typeof card.estimatedMinutes === 'number' && (
              <span className={styles.guideCardMinutes}>{card.estimatedMinutes} min</span>
            )}
            {!card.completed && card.prereqs.length > 0 && (
              <span className={styles.guideCardPrereqs}>
                <span className={styles.guideCardPrereqLabel}>first:</span>
                {card.prereqs.slice(0, MAX_PREREQ_CHIPS).map((p) => (
                  <Link
                    key={p.id}
                    href={`/home/guides/${p.slug}`}
                    className={styles.guideCardPrereqChip}
                    onClick={onNavigate}
                  >
                    {p.topicTitle}
                  </Link>
                ))}
                {hiddenPrereqs > 0 && (
                  <span className={styles.guideCardPrereqMore}>and {hiddenPrereqs} more</span>
                )}
              </span>
            )}
            <Link
              href={`/home/guides/${card.slug}`}
              className={styles.guideCardGo}
              onClick={onNavigate}
            >
              open node
            </Link>
          </div>
        </div>
      );
    })}
  </div>
);

export default GuideCardsInline;
