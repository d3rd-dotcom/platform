'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import styles from './InventoryPanel.module.css';

type MembershipTier = 'Guest' | 'Angel' | 'Staff';

const EMPTY_VALUES = new Set(['0', '0.00', '000']);

export default function InventoryPanel() {
  const { user, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;

  const [credits, setCredits] = useState('000');
  const [tier, setTier] = useState<MembershipTier | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

      const meRes = await window.fetch('/api/me', { credentials: 'include', cache: 'no-store', headers });
      const meData = meRes.ok ? await meRes.json().catch(() => null) : null;
      if (meData?.user?.shardCount !== undefined) {
        setCredits(String(meData.user.shardCount).padStart(3, '0'));
      }

      const statusUrl = address
        ? `/api/account/status?walletAddress=${encodeURIComponent(address)}`
        : '/api/account/status';
      const status = await window
        .fetch(statusUrl, { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json().catch(() => null) : null))
        .catch(() => null);
      setTier(
        status?.hasVipMembershipCard ? 'Staff' : status?.hasAcademicAngel ? 'Angel' : 'Guest',
      );
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [address, getAccessToken]);

  useEffect(() => {
    fetchData();
    const handleShards = () => fetchData();
    window.addEventListener('shardsUpdated', handleShards);
    return () => window.removeEventListener('shardsUpdated', handleShards);
  }, [fetchData]);

  const isMember = tier === 'Angel' || tier === 'Staff';
  const tierLabel =
    tier === 'Staff' ? 'Staff / VIP' : tier === 'Angel' ? 'Academic Angel' : 'Guest';
  const tierEmoji = tier === 'Staff' ? '👑' : tier === 'Angel' ? '😇' : '🧑';

  const slots: Array<{ label: string; icon: string; value: string; tooltip: string; unoptimized?: boolean }> = [
    { label: 'Diamonds',     icon: '/icons/ui-diamond.svg',     value: credits, tooltip: 'Earned through quests, lessons, and check-ins.' },
    { label: 'Certificates', icon: '/icons/badge-academy.png',  value: '0',     tooltip: 'Awarded for completing Academy milestones.', unoptimized: true },
    { label: 'Awards',       icon: '/icons/rewards.svg',        value: '0',     tooltip: 'Granted by staff for outstanding participation.' },
  ];

  return (
    <div className={styles.panel}>
      <span className={styles.title}>Inventory</span>

      <div className={styles.grid}>
        {slots.map((slot) => {
          const empty = EMPTY_VALUES.has(slot.value);
          return (
            <div
              key={slot.label}
              className={`${styles.slot} ${empty ? styles.slotEmpty : styles.slotFilled}`}
              title={slot.tooltip}
            >
              <div className={styles.iconWrap}>
                <Image
                  src={slot.icon}
                  alt={slot.label}
                  width={28}
                  height={28}
                  className={styles.icon}
                  unoptimized={slot.unoptimized}
                />
              </div>
              {!empty && <span className={styles.count}>{slot.value}</span>}
              <span className={styles.label}>{slot.label}</span>
            </div>
          );
        })}
      </div>

      <div className={`${styles.membershipSlot} ${isMember ? styles.membershipFilled : ''}`}>
        <span className={styles.membershipIcon} role="img" aria-label={tierLabel}>{tierEmoji}</span>
        <div className={styles.membershipInfo}>
          <span className={styles.membershipMeta}>Membership</span>
          <span className={`${styles.membershipTier} ${isMember ? styles.membershipTierActive : ''}`}>
            {loading && tier === null ? '--' : tierLabel}
          </span>
        </div>
      </div>

      <Link href="/quests" className={styles.questsLink}>Explore quests</Link>
    </div>
  );
}
