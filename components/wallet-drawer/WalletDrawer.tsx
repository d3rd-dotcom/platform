'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { createPublicClient, http, formatEther, erc20Abi } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { getChainConfig } from '@/lib/chain-config';
import styles from './WalletDrawer.module.css';

interface WalletDrawerProps {
  open: boolean;
  onClose: () => void;
  displayName: string | null;
  initials: string;
  avatarUrl: string | null;
  address: string | undefined;
  onChangeAvatar: () => void;
  onChangeUsername: () => void;
  onConnections: () => void;
  onSignOut: () => void;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function WalletDrawer({
  open,
  onClose,
  displayName,
  initials,
  avatarUrl,
  address,
  onChangeAvatar,
  onChangeUsername,
  onConnections,
  onSignOut,
}: WalletDrawerProps) {
  const [addressCopied, setAddressCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Onchain wallet balances
  const [onchainEth, setOnchainEth] = useState<string | null>(null);
  const [onchainDiamonds, setOnchainDiamonds] = useState<string | null>(null);
  const [onchainBtc, setOnchainBtc] = useState<string | null>(null);
  const [onchainUsdc, setOnchainUsdc] = useState<string | null>(null);

  const cfg = getChainConfig();
  const hasBtc = Boolean(cfg.cbBTcAddress);

  const fetchOnchainBalances = useCallback(async (addr: string) => {
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
  }, [cfg.chainId, cfg.rpcUrl, cfg.diamondsTokenAddress, cfg.usdcAddress, cfg.cbBTcAddress]);

  // Fetch when opened; clear when closed
  useEffect(() => {
    if (open && address) {
      void fetchOnchainBalances(address);
    } else if (!open) {
      setOnchainEth(null);
      setOnchainDiamonds(null);
      setOnchainBtc(null);
      setOnchainUsdc(null);
    }
  }, [open, address, fetchOnchainBalances]);

  // Escape to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    return () => { if (copyTimerRef.current) clearTimeout(copyTimerRef.current); };
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

  const netLabel = cfg.chainId === 84532 ? 'Base Sepolia' : 'Base';

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropOpen : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`${styles.drawer} ${open ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet and profile"
        aria-hidden={!open}
      >
        {/* Header / identity */}
        <header className={styles.header}>
          <div className={styles.identity}>
            <div className={styles.avatar}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName || 'Profile'} width={48} height={48} className={styles.avatarImg} unoptimized />
              ) : (
                <span className={styles.avatarInitials}>{initials}</span>
              )}
            </div>
            <div className={styles.identityText}>
              <span className={styles.name}>
                {displayName ? `@${displayName}` : 'Connected'}
              </span>
              {address ? (
                <button
                  type="button"
                  className={`${styles.walletChip} ${addressCopied ? styles.walletChipCopied : ''}`}
                  onClick={() => void handleCopyAddress()}
                  title="Copy wallet address"
                >
                  <span className={styles.walletAddr}>{truncate(address)}</span>
                  <span className={styles.copyHint}>{addressCopied ? 'Copied' : 'Copy'}</span>
                </button>
              ) : (
                <span className={styles.nameMuted}>No wallet linked</span>
              )}
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {/* Balances */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>Balances</h3>
              <span className={styles.netBadge}>{netLabel}</span>
            </div>

            {/* Featured — Diamonds */}
            <div className={styles.heroCard}>
              <div className={styles.heroLeft}>
                <div className={styles.heroIcon}>
                  <Image src="/icons/ui-diamond.svg" alt="" width={22} height={22} />
                </div>
                <div className={styles.heroMeta}>
                  <span className={styles.heroName}>Diamonds</span>
                  <span className={styles.heroSub}>Credits balance</span>
                </div>
              </div>
              <span className={styles.heroValue}>
                {address ? (onchainDiamonds ?? '—') : '—'}
              </span>
            </div>

            {/* Other tokens */}
            <div className={styles.tokenGrid}>
              <div className={styles.tokenCard}>
                <div className={styles.tokenTop}>
                  <div className={styles.tokenIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#8A92B2" />
                      <path d="M2 17l10 5 10-5" fill="#62688F" />
                      <path d="M2 12l10 5 10-5" fill="#8A92B2" />
                    </svg>
                  </div>
                  <span className={styles.tokenName}>ETH</span>
                </div>
                <span className={styles.tokenValue}>{address ? (onchainEth ?? '—') : '—'}</span>
              </div>

              <div className={styles.tokenCard}>
                <div className={styles.tokenTop}>
                  <div className={styles.tokenIcon}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#2775CA" />
                      <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">$</text>
                    </svg>
                  </div>
                  <span className={styles.tokenName}>USDC</span>
                </div>
                <span className={styles.tokenValue}>{address ? (onchainUsdc ?? '—') : '—'}</span>
              </div>

              {hasBtc && (
                <div className={styles.tokenCard}>
                  <div className={styles.tokenTop}>
                    <div className={styles.tokenIcon}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" fill="#0052FF" />
                        <path d="M12 6v12" stroke="white" strokeWidth="1.5" />
                        <path d="M9.5 8.5h4.5a2.5 2.5 0 0 1 0 5h-4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                        <path d="M9.5 13.5h5a2 2 0 0 1 0 4h-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                    </div>
                    <span className={styles.tokenName}>cbBTC</span>
                  </div>
                  <span className={styles.tokenValue}>{address ? (onchainBtc ?? '—') : '—'}</span>
                </div>
              )}
            </div>
          </section>

          {/* Account actions */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Account</h3>
            <div className={styles.menu}>
              <button className={styles.menuItem} type="button" onClick={() => { onClose(); onChangeAvatar(); }}>
                <span>Change avatar</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <button className={styles.menuItem} type="button" onClick={() => { onClose(); onChangeUsername(); }}>
                <span>Change username</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
              <button className={styles.menuItem} type="button" onClick={() => { onClose(); onConnections(); }}>
                <span>Connections</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            </div>
          </section>

          <button
            className={styles.signOut}
            type="button"
            onClick={() => { onClose(); onSignOut(); }}
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
