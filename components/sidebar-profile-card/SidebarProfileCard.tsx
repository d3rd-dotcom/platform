'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import styles from './SidebarProfileCard.module.css';

interface SidebarProfileCardProps {
  username: string | null;
  avatarUrl: string | null;
  address: string | undefined;
  isCollapsed: boolean;
  onOpenWallet: () => void;
  onViewProfile?: () => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function SidebarProfileCard({
  username,
  avatarUrl,
  address,
  isCollapsed,
  onOpenWallet,
  onViewProfile,
}: SidebarProfileCardProps) {
  const router = useRouter();
  const displayName = username && !username.startsWith('user_') ? username : null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??';

  const handleProfileClick = () => {
    if (onViewProfile) {
      onViewProfile();
    } else {
      router.push('/profile');
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        className={`${styles.cardCollapsed} ${styles.cardCollapsedClickable}`}
        onClick={handleProfileClick}
        aria-label="View profile"
        title="View profile"
      >
        {avatarUrl ? (
          <Image src={avatarUrl} alt={displayName || 'Profile'} width={36} height={36} className={styles.avatarSm} unoptimized />
        ) : (
          <div className={styles.avatarFallbackSm}>{initials}</div>
        )}
      </button>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.profileArea}
          onClick={handleProfileClick}
          aria-label="View profile"
          title="View profile"
        >
          {avatarUrl ? (
            <Image src={avatarUrl} alt={displayName || 'Profile'} width={32} height={32} className={styles.avatar} unoptimized />
          ) : (
            <div className={styles.avatarFallback}>{initials}</div>
          )}

          <div className={styles.info}>
            {displayName ? (
              <span className={styles.name}>@{displayName}</span>
            ) : (
              <span className={styles.nameMuted}>not connected</span>
            )}
            {address && (
              <span className={styles.wallet}>{truncate(address)}</span>
            )}
          </div>
        </button>

        <button
          className={styles.menuBtn}
          onClick={onOpenWallet}
          type="button"
          aria-label="Open wallet"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>
    </div>
  );
}
