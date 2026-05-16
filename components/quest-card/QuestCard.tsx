'use client';

import React from 'react';
import Image from 'next/image';
import { Check, Lock, Trash } from '@phosphor-icons/react';
import styles from './QuestCard.module.css';

export type QuestCardKind = 'course' | 'submit' | 'mission' | 'social' | 'custom';

interface QuestCardProps {
  title: string;
  description: string;
  progressCurrent: number;
  progressTotal: number;
  points: number;
  kind: QuestCardKind;
  isLocked?: boolean;
  showDelete?: boolean;
  onOpen?: () => void;
  onDelete?: () => void;
}

const QuestCard: React.FC<QuestCardProps> = ({
  title,
  description,
  progressCurrent,
  progressTotal,
  points,
  kind,
  isLocked = false,
  showDelete = false,
  onOpen,
  onDelete,
}) => {
  const completed = progressCurrent >= progressTotal && progressTotal > 0;

  return (
    <div
      className={`${styles.card} ${completed ? styles.cardComplete : ''} ${isLocked ? styles.cardLocked : ''}`}
      data-kind={kind}
    >
      <button
        type="button"
        className={styles.cardSurface}
        onClick={onOpen}
        disabled={isLocked}
        aria-label={`Open quest: ${title}`}
      >
        <span className={styles.artwork} data-kind={kind} aria-hidden="true" />

        <span className={styles.info}>
          <span className={styles.title}>{title}</span>
          <span className={styles.preview}>{description}</span>
        </span>

        <span className={styles.right}>
          {completed ? (
            <span className={styles.checkDone}>
              <Check size={15} weight="bold" />
            </span>
          ) : isLocked ? (
            <span className={styles.lockChip}>
              <Lock size={13} weight="fill" />
            </span>
          ) : (
            <span className={styles.points}>
              <Image src="/icons/ui-shard.svg" alt="" width={13} height={13} />
              <span className={styles.pointsValue}>{points}</span>
            </span>
          )}
        </span>
      </button>

      {showDelete && onDelete && (
        <button
          type="button"
          className={styles.deleteBtn}
          onClick={onDelete}
          aria-label={`Delete quest: ${title}`}
        >
          <Trash size={13} weight="bold" />
        </button>
      )}
    </div>
  );
};

export default QuestCard;
