'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import BlueScene from '@/components/blue-scene/BlueScene';
import ChatRoom from '@/components/chat-room/ChatRoom';
import TreasurySwapModal from '@/components/treasury-swap/TreasurySwapModal';
import CtaButton from '@/components/shared/CtaButton';
import type { TreasurySnapshot } from '@/lib/treasury-snapshot';
import styles from './Dashboard.module.css';

function formatBalance(amount: string | null, maximumFractionDigits: number): string {
  if (amount === null) return 'Unavailable';
  const value = Number(amount);
  if (!Number.isFinite(value)) return 'Unavailable';
  if (value === 0) return '0';

  return value.toLocaleString('en-US', {
    maximumFractionDigits,
    minimumFractionDigits: value < 0.01 ? Math.min(maximumFractionDigits, 4) : 0,
  });
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function Dashboard() {
  const [treasury, setTreasury] = useState<TreasurySnapshot | null>(null);
  const [treasuryLoading, setTreasuryLoading] = useState(false);
  const [treasuryFailed, setTreasuryFailed] = useState(false);
  const [showTreasurySwap, setShowTreasurySwap] = useState(false);

  const loadTreasury = useCallback(() => {
    if (treasuryLoading || treasury !== null) return;
    const controller = new AbortController();
    setTreasuryLoading(true);

    fetch('/api/treasury/snapshot', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Treasury request failed');
        return response.json() as Promise<TreasurySnapshot>;
      })
      .then((snapshot) => setTreasury(snapshot))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setTreasuryFailed(true);
      })
      .finally(() => setTreasuryLoading(false));

    return () => controller.abort();
  }, [treasury, treasuryLoading]);

  return (
    <div className={styles.dashboard}>

      {/* ── BlueScene ── */}
      <div className={styles.blueSceneWrap}>
        <BlueScene />
      </div>

      {/* ── Sidebar: Blue's Treasures + ChatRoom ── */}
      <aside className={styles.sidebarWrap}>
        <section className={`${styles.leaderboardCard} ${styles.treasuryCard}`} aria-labelledby="home-blue-treasures-title">
          <div className={styles.leaderHead}>
            <span className={styles.leaderIcon}>宝物</span>
            <span id="home-blue-treasures-title" className={`${styles.leaderTitle} ${styles.treasuryTitle}`}>
              BLUE&apos;S TREASURES
            </span>
            <button
              type="button"
              className={styles.treasuryBadge}
              onClick={() => setShowTreasurySwap(true)}
            >
              Swap
            </button>
          </div>

          {treasuryLoading ? (
            <div className={styles.treasurySkeleton} aria-label="Loading Blue's treasures" aria-live="polite">
              <span /><span /><span /><span />
            </div>
          ) : treasury === null && !treasuryFailed ? (
            <CtaButton className={styles.treasuryLoadButton} size="sm" onClick={loadTreasury}>Load</CtaButton>
          ) : treasuryFailed ? (
            <p className={styles.leaderEmpty}>Blue&apos;s Wallet balances are temporarily unavailable.</p>
          ) : (
            <>
              <div className={styles.treasuryGrid} aria-live="polite">
                <div className={styles.treasuryMetric}>
                  <Image
                    className={styles.treasuryMetricIcon}
                    src="/tokens/cbbtc.webp"
                    alt=""
                    width={20}
                    height={20}
                  />
                  <span className={styles.treasuryMetricLabel}>Bitcoin held</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.cbBtc.amount, 8) : '—'}
                    {treasury?.balances.cbBtc.amount !== null && <small> Bitcoin</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <Image
                    className={styles.treasuryMetricIcon}
                    src="/icons/ui-diamond.svg"
                    alt=""
                    width={20}
                    height={20}
                  />
                  <span className={styles.treasuryMetricLabel}>Diamonds held</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.credits.amount, 2) : '—'}
                    {treasury?.balances.credits.amount !== null && <small> diamonds</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <Image
                    className={styles.treasuryMetricIcon}
                    src="/tokens/cbbtc.webp"
                    alt=""
                    width={20}
                    height={20}
                  />
                  <span className={styles.treasuryMetricLabel}>Vault Bitcoin</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.vault.cbBtcBalance, 8) : '—'}
                    {treasury?.vault.cbBtcBalance !== null && <small> Bitcoin</small>}
                  </strong>
                </div>
                <div className={styles.treasuryMetric}>
                  <Image
                    className={styles.treasuryMetricIcon}
                    src="/tokens/eth.png"
                    alt=""
                    width={20}
                    height={20}
                  />
                  <span className={styles.treasuryMetricLabel}>Base gas</span>
                  <strong className={styles.treasuryMetricValue}>
                    {treasury ? formatBalance(treasury.balances.eth.amount, 6) : '—'}
                    {treasury?.balances.eth.amount !== null && <small> ETH</small>}
                  </strong>
                </div>
              </div>

              {treasury?.vault.address ? (
                <p className={styles.treasuryNote}>
                  {treasury.vault.totalDistributed === null
                    ? 'Reflection vault data is unavailable.'
                    : `${formatBalance(treasury.vault.totalDistributed, 4)} Bitcoin distributed`}
                  {treasury.vault.eligibleHolders !== null
                    ? ` across ${treasury.vault.eligibleHolders.toLocaleString()} eligible holders.`
                    : '.'}
                </p>
              ) : treasury ? (
                <p className={styles.treasuryNote}>The reflection vault is awaiting its Base deployment.</p>
              ) : null}

              {treasury?.wallet.address && treasury.wallet.explorerUrl && (
                <a
                  className={styles.treasuryWalletLink}
                  href={treasury.wallet.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Wallet {shortAddress(treasury.wallet.address)}</span>
                  <span aria-hidden="true">↗</span>
                </a>
              )}
            </>
          )}
        </section>

        <div className={styles.chatRoomDesktopOnly}><ChatRoom fullPage /></div>
      </aside>

      <TreasurySwapModal
        open={showTreasurySwap}
        onClose={() => setShowTreasurySwap(false)}
      />

    </div>
  );
}
