'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import styles from './InventoryPanel.module.css';

const DAYS = 7;
const REWARD = 100;

export default function InventoryPanel() {
  const { getAccessToken } = usePrivy();

  const [credits, setCredits] = useState(0);

  const fetchCredits = useCallback(async () => {
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const meRes = await window.fetch('/api/me', { credentials: 'include', cache: 'no-store', headers });
      const meData = meRes.ok ? await meRes.json().catch(() => null) : null;
      if (meData?.user?.shardCount !== undefined) {
        setCredits(meData.user.shardCount);
      }
    } catch {
      /* silent */
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchCredits();
    const handleShards = () => fetchCredits();
    window.addEventListener('shardsUpdated', handleShards);
    return () => window.removeEventListener('shardsUpdated', handleShards);
  }, [fetchCredits]);

  const earned = Math.min(Math.floor(credits / REWARD), DAYS);
  const today = new Date().getDay();
  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>Daily stream</span>
        <span className={styles.total}>{credits}</span>
      </div>

      <div className={styles.track}>
        {Array.from({ length: DAYS }, (_, i) => {
          const filled = i < earned;
          const isToday = i === today;

          return (
            <div
              key={i}
              className={`${styles.day} ${filled ? styles.dayFilled : ''} ${isToday && !filled ? styles.dayToday : ''}`}
            >
              <div className={styles.dayIcon}>
                <Image
                  src="/icons/ui-diamond.svg"
                  alt=""
                  width={filled ? 18 : 14}
                  height={filled ? 18 : 14}
                  className={filled ? styles.iconLit : styles.iconDim}
                />
              </div>
              <span className={`${styles.dayValue} ${filled ? styles.dayValueFilled : ''}`}>
                {REWARD}
              </span>
              <span className={styles.dayLabel}>{dayLabels[i]}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.progress}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${(earned / DAYS) * 100}%` }}
          />
        </div>
        <span className={styles.progressText}>{earned}/{DAYS}</span>
      </div>
    </div>
  );
}
