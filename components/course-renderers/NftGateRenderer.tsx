'use client';

import { useState } from 'react';
import { ShieldCheck, Shield } from '@phosphor-icons/react';
import type { CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './NftGateRenderer.module.css';

interface NftGateConfig {
  collection?: string;
  contractAddress?: string;
}

const COLLECTION_NAMES: Record<string, string> = {
  academic_angels: 'Academic Angels',
  vip_club: 'VIP Club',
};

const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  academic_angels: 'Requires an Academic Angels NFT to unlock',
  vip_club: 'Requires a VIP Club membership NFT to unlock',
};

export default function NftGateRenderer({ component }: { component: CourseComponentRecord }) {
  const config = component.config as NftGateConfig;
  const collection = config.collection ?? 'academic_angels';
  const collectionName = COLLECTION_NAMES[collection] ?? 'Custom Collection';
  const description = COLLECTION_DESCRIPTIONS[collection] ?? `Requires an NFT from ${config.contractAddress || 'a custom collection'}`;
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const handleVerify = () => {
    setChecking(true);
    // Simulate verification — in production this would call wallet/nft check
    setTimeout(() => {
      setChecking(false);
      setUnlocked(true);
    }, 1200);
  };

  if (unlocked) {
    return (
      <div className={`${styles.gate} ${styles.gateUnlocked}`}>
        <div className={`${styles.icon} ${styles.iconUnlocked}`}>
          <ShieldCheck size={22} weight="bold" />
        </div>
        <p className={styles.statusText}>NFT Verified</p>
        <p className={styles.collectionName}>{collectionName}</p>
      </div>
    );
  }

  return (
    <div className={styles.gate}>
      <div className={styles.icon}>
        <Shield size={22} weight="bold" />
      </div>
      <p className={styles.collectionName}>{collectionName}</p>
      <p className={styles.description}>{description}</p>
      <button
        type="button"
        className={styles.verifyBtn}
        onClick={handleVerify}
        disabled={checking}
      >
        {checking ? 'Verifying...' : 'Verify NFT'}
      </button>
    </div>
  );
}
