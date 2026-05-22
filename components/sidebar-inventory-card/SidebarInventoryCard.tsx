'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { providers, Contract } from 'ethers';
import styles from './SidebarInventoryCard.module.css';

interface SidebarInventoryCardProps {
  shardCount: number | null;
  address: string | undefined;
  isCollapsed: boolean;
}

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

// Membership tier shown in the profile card. Staff (VIP card) outranks Angel.
type MembershipTier = 'Guest' | 'Angel' | 'Staff';

export default function SidebarInventoryCard({ shardCount, address, isCollapsed }: SidebarInventoryCardProps) {
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [votingPower, setVotingPower] = useState<string | null>(null);
  const [tier, setTier] = useState<MembershipTier | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const statusUrl = address
        ? `/api/account/status?walletAddress=${encodeURIComponent(address)}`
        : '/api/account/status';
      const status = await window.fetch(statusUrl, { cache: 'no-store', credentials: 'include' })
        .then(r => r.ok ? r.json().catch(() => null) : null)
        .catch(() => null);
      const resolvedTier: MembershipTier = status?.hasVipMembershipCard
        ? 'Staff'
        : status?.hasAcademicAngel
          ? 'Angel'
          : 'Guest';
      setTier(resolvedTier);

      if (typeof window === 'undefined' || !window.ethereum) return;
      const provider = new providers.Web3Provider(window.ethereum);
      const accounts = await provider.listAccounts();
      if (!accounts.length) return;
      const addr = accounts[0];

      const usdc = new Contract(USDC_ADDRESS, ERC20_ABI, provider);
      const ks = new Contract(CONTRACT_ADDRESS, KILLSTREAK_ABI, provider);

      const [usdcRaw, usdcDec, vpRaw] = await Promise.all([
        usdc.balanceOf(addr),
        usdc.decimals(),
        ks.getVotingPower(addr).catch(() => null),
      ]);

      setUsdcBalance(fmt(usdcRaw, Number(usdcDec), 2));
      if (vpRaw !== null) {
        const vp = Number(vpRaw) / 1e18;
        setVotingPower(vp >= 1 ? Math.floor(vp).toLocaleString() : vp.toFixed(2));
      } else {
        setVotingPower('0');
      }
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) fetch();
  }, [address, fetch]);

  const shardDisplay = shardCount !== null ? String(shardCount).padStart(3, '0') : '000';
  const isMember = tier === 'Angel' || tier === 'Staff';
  const tierStatusClass = tier === null ? '' : isMember ? styles.statValuePositive : styles.statValueNegative;

  if (isCollapsed) {
    return (
      <div className={styles.cardCollapsed} data-tour="shards">
        <Image src="/icons/ui-shard.svg" alt="Gems" width={18} height={18} className={styles.shardIconSm} />
        <span className={styles.shardCountSm}>{shardDisplay}</span>
      </div>
    );
  }

  return (
    <div className={styles.card} data-tour="shards">
      <div className={styles.shardsHero}>
        <div className={styles.shardsHeroLeft}>
          <Image src="/icons/ui-shard.svg" alt="" width={34} height={34} className={styles.shardsHeroIcon} />
          <span className={styles.shardsHeroLabel}>Gems</span>
        </div>
        <span className={styles.shardsHeroValue}>{shardDisplay}</span>
      </div>

      <div className={styles.balanceDivider} />
      <div className={styles.balanceList}>
        {loading ? (
          <>
            {[0, 1, 2].map(i => (
              <div key={i} className={styles.balanceRow}>
                <div className={styles.tokenLeft}>
                  <div className={`${styles.tokenIcon} ${styles.skeletonIcon}`} />
                  <span className={styles.skeletonText} style={{ width: 36 }} />
                </div>
                <span className={styles.skeletonText} style={{ width: 28 }} />
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenVotes}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.tokenName}>Votes</span>
              </div>
              <span className={styles.balanceVal}>{votingPower ?? '0'}</span>
            </div>
            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${isMember ? styles.tokenVipActive : styles.tokenVip}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <span className={styles.tokenName}>Membership</span>
              </div>
              <span className={`${styles.balanceVal} ${tierStatusClass}`}>{tier === null ? '--' : tier}</span>
            </div>
            <div className={styles.balanceRow}>
              <div className={styles.tokenLeft}>
                <div className={`${styles.tokenIcon} ${styles.tokenUsdc}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" fill="#2775CA" />
                    <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
                  </svg>
                </div>
                <span className={styles.tokenName}>USDC</span>
              </div>
              <span className={styles.balanceVal}>{usdcBalance ?? '0.00'}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
