'use client';

import React from 'react';
import Image from 'next/image';
import styles from './BlueChatBubble.module.css';

const BLUE_AVATAR_SRC = '/images/blue-portrait.png';

interface BlueChatBubbleProps {
  message: string;
  className?: string;
  variant?: 'default' | 'featured' | 'compact';
  /** Optional eyebrow context shown after the name, e.g. "Review" -> "Blue · Review". */
  context?: string;
  ariaLive?: 'off' | 'polite' | 'assertive';
}

export default function BlueChatBubble({
  message,
  className = '',
  variant = 'default',
  context,
  ariaLive = 'off',
}: BlueChatBubbleProps) {
  const variantClass =
    variant === 'featured'
      ? styles.featured
      : variant === 'compact'
        ? styles.compact
        : '';

  return (
    <div className={`${styles.shell} ${variantClass} ${className}`} aria-live={ariaLive}>
      <div className={styles.avatar}>
        <Image src={BLUE_AVATAR_SRC} alt="Blue" width={56} height={56} unoptimized />
      </div>
      <div className={styles.body}>
        <span className={styles.sender}>
          Blue{context ? <span className={styles.context}> · {context}</span> : null}
        </span>
        <div className={styles.bubble}>
          <p className={styles.message}>{message}</p>
        </div>
      </div>
    </div>
  );
}
