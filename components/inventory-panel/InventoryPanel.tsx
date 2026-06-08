'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { providers, Contract } from 'ethers';
import styles from './InventoryPanel.module.css';

type MembershipTier = 'Guest' | 'Angel' | 'Staff';

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_BLUE_KILLSTREAK_ADDRESS ||
  '0x09a4FEfEe8245B644713546FDF28b4160218f7Fc';
const USDC_ADDRESS =
  process.env.NEXT_PUBLIC_USDC_ADDRESS ||
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
];
const KILLSTREAK_ABI = [
  'function getVotingPower(address _voter) external view returns (uint256)',
];

function fmt(raw: unknown, decimals: number, max = 4): string {
  const n = Number(raw) / 10 ** decimals;
  if (n === 0) return '0.00';
  if (n < 0.0001) return '<0.001';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: max });
}

const EMPTY_VALUES = new Set(['0', '0.00', '000']);

export default function InventoryPanel() {
  const { user, getAccessToken } = usePrivy();
  const address = user?.wallet?.address;

  const [credits, setCredits] = useState('000');
  const [cakes, setCakes] = useState('0');
  const [usdc, setUsdc] = useState('0.00');
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

      if (typeof window !== 'undefined' && window.ethereum) {
        const provider = new providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length) {
          const addr = accounts[0];
          const usdcContract = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
          const ksContract = new Contract(CONTRACT_ADDRESS, KILLSTREAK_ABI, provider);
          const [usdcRaw, usdcDec, vpRaw] = await Promise.all([
            usdcContract.balanceOf(addr),
            usdcContract.decimals(),
            ksContract.getVotingPower(addr).catch(() => null),
          ]);
          setUsdc(fmt(usdcRaw, Number(usdcDec), 2));
          if (vpRaw !== null) {
            const vp = Number(vpRaw) / 1e18;
            setCakes(
              vp === 0 ? '0' : vp >= 1 ? Math.floor(vp).toLocaleString() : vp < 0.01 ? '<0.01' : vp.toFixed(2),
            );
          }
        }
      }
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

  const slots = [
    { label: 'Diamonds',      icon: '/icons/ui-shard.svg',      value: credits, tooltip: 'Earned through quests, lessons, and check-ins.' },
    { label: 'Cakes',        icon: '/icons/cake.webp',          value: cakes,   tooltip: 'Awarded for participation. Used for governance.', unoptimized: true },
    { label: 'USDC',         icon: '/icons/usdc-logo.svg',      value: usdc,    tooltip: 'Quest payouts sent to your connected wallet.', unoptimized: true },
    { label: 'Certificates', icon: '/icons/ui-seal.svg',        value: '0',     tooltip: 'Awarded for completing Academy milestones.' },
    { label: 'Badges',       icon: '/icons/badge-academy.png',  value: '0',     tooltip: 'Earned for special achievements.', unoptimized: true },
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
        <Image src="/icons/governance.svg" alt="" width={16} height={16} className={styles.membershipIcon} />
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
