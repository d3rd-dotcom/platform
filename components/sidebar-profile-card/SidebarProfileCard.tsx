'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createPublicClient, http, formatEther, erc20Abi } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getChainConfig } from '@/lib/chain-config';
import styles from './SidebarProfileCard.module.css';

interface SidebarProfileCardProps {
  username: string | null;
  avatarUrl: string | null;
  address: string | undefined;
  isCollapsed: boolean;
  onChangeAvatar: () => void;
  onChangeUsername: () => void;
  onConnections: () => void;
  onSignOut: () => void;
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
  onChangeAvatar,
  onChangeUsername,
  onConnections,
  onSignOut,
  onViewProfile,
}: SidebarProfileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [addressCopied, setAddressCopied] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Onchain wallet balances
  const [onchainEth, setOnchainEth] = useState<string | null>(null);
  const [onchainDiamonds, setOnchainDiamonds] = useState<string | null>(null);
  const [onchainBtc, setOnchainBtc] = useState<string | null>(null);
  const [onchainUsdc, setOnchainUsdc] = useState<string | null>(null);

  const fetchOnchainBalances = useCallback(async (addr: string) => {
    const cfg = getChainConfig();
    const chain = cfg.chainId === 84532 ? baseSepolia : base;
    const client = createPublicClient({ chain, transport: http(cfg.rpcUrl) });
    try {
      const a = addr as `0x${string}`;
      const eth = await client.getBalance({ address: a });
      setOnchainEth(Number(formatEther(eth)).toFixed(4));

      const balanceOf = (token: string) => ({
        address: token as `0x${string}`,
        abi: erc20Abi,
        functionName: 'balanceOf' as const,
        args: [a] as const,
      });
      const [diamondsR, usdcR, btcR] = await client.multicall({
        contracts: [
          balanceOf(cfg.diamondsTokenAddress),
          balanceOf(cfg.usdcAddress),
          ...(cfg.cbBTcAddress ? [balanceOf(cfg.cbBTcAddress)] : []),
        ],
        allowFailure: true,
      });

      if (diamondsR.status === 'success') {
        const d = Number(diamondsR.result) / 1e18;
        setOnchainDiamonds(d < 1 ? d.toFixed(2) : Math.floor(d).toLocaleString());
      }
      if (usdcR.status === 'success') {
        setOnchainUsdc((Number(usdcR.result) / 1e6).toLocaleString('en-US', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }));
      }
      if (btcR && btcR.status === 'success') {
        setOnchainBtc((Number(btcR.result) / 1e8).toFixed(8));
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    if (menuOpen && address) void fetchOnchainBalances(address);
    else if (!menuOpen) {
      setOnchainEth(null);
      setOnchainDiamonds(null);
      setOnchainBtc(null);
      setOnchainUsdc(null);
    }
  }, [menuOpen, address, fetchOnchainBalances]);
  const displayName = username && !username.startsWith('user_') ? username : null;
  const initials = displayName
    ? displayName.slice(0, 2).toUpperCase()
    : address
    ? address.slice(2, 4).toUpperCase()
    : '??';

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyAddress = async () => {
    if (!address) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(address);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = address;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setAddressCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setAddressCopied(false), 1400);
    } catch (error) {
      console.error('Failed to copy wallet address:', error);
    }
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        className={`${styles.cardCollapsed} ${onViewProfile ? styles.cardCollapsedClickable : ''}`}
        onClick={onViewProfile}
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
    <div className={styles.card} ref={menuRef}>
      <div className={styles.row}>
        <button
          type="button"
          className={styles.profileArea}
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Profile options"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          title="Profile options"
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
          className={`${styles.menuBtn} ${menuOpen ? styles.menuBtnOpen : ''}`}
          onClick={() => setMenuOpen(v => !v)}
          type="button"
          aria-label="Profile options"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
          </svg>
        </button>
      </div>

      {menuOpen && (
        <div className={styles.menu}>
          <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onChangeAvatar(); }} type="button">Change Avatar</button>
          <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onChangeUsername(); }} type="button">Change Username</button>
          {address && (
            <button
              className={`${styles.menuItem} ${addressCopied ? styles.menuItemSuccess : ''}`}
              onClick={() => void handleCopyAddress()}
              type="button"
            >
              {addressCopied ? 'Copied Address' : 'Copy Address'}
            </button>
          )}
          {address && (
            <>
              <div className={styles.menuDivider} />
              <div className={styles.balanceSection}>
                <div className={styles.balanceRow}>
                  <div className={styles.tokenIcon}>
                    <Image src="/icons/ui-diamond.svg" alt="" width={12} height={12} />
                  </div>
                  <span className={styles.tokenName}>Diamonds</span>
                  <span className={styles.balanceVal}>{onchainDiamonds ?? '—'}</span>
                </div>
                {getChainConfig().cbBTcAddress && (
                  <div className={styles.balanceRow}>
                    <div className={styles.tokenIcon}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#0052FF" />
                        <path d="M12 6v12" stroke="white" strokeWidth="1.5" />
                        <path d="M9.5 8.5h4.5a2.5 2.5 0 0 1 0 5h-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M9.5 13.5h5a2 2 0 0 1 0 4h-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className={styles.tokenName}>cbBTC</span>
                    <span className={styles.balanceVal}>{onchainBtc ?? '—'}</span>
                  </div>
                )}
                <div className={styles.balanceRow}>
                  <div className={styles.tokenIcon}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#2775CA" />
                      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
                    </svg>
                  </div>
                  <span className={styles.tokenName}>USDC</span>
                  <span className={styles.balanceVal}>{onchainUsdc ?? '—'}</span>
                </div>
                <div className={styles.balanceRow}>
                  <div className={styles.tokenIcon}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#8A92B2" />
                      <path d="M2 17l10 5 10-5" fill="#62688F" />
                      <path d="M2 12l10 5 10-5" fill="#8A92B2" />
                    </svg>
                  </div>
                  <span className={styles.tokenName}>ETH</span>
                  <span className={styles.balanceVal}>{onchainEth ?? '—'}</span>
                </div>
              </div>
              <div className={styles.menuDivider} />
            </>
          )}
          <button className={styles.menuItem} onClick={() => { setMenuOpen(false); onConnections(); }} type="button">Connections</button>
          <div className={styles.menuDivider} />
          <button className={`${styles.menuItem} ${styles.menuItemDanger}`} onClick={() => { setMenuOpen(false); onSignOut(); }} type="button">Sign Out</button>
        </div>
      )}
    </div>
  );
}
