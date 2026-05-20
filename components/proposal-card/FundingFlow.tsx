'use client';

import React from 'react';
import Image from 'next/image';
import styles from './FundingFlow.module.css';

export type FlowOutcome = 'pending' | 'voting' | 'funded' | 'rejected' | 'expired';

interface FundingFlowProps {
  proposer: {
    username: string | null;
    avatarUrl: string | null;
    walletAddress: string;
  };
  /** Requested amount in whole USDC. */
  requestedUsd: number | null;
  /** Recipient address, or null when none is set. */
  recipient: string | null;
  outcome: FlowOutcome;
}

function shortAddr(a: string): string {
  if (!a || a.length < 10) return a || '';
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function usd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const OUTCOME_LABEL: Record<FlowOutcome, string> = {
  pending: 'Pending',
  voting: 'Voting',
  funded: 'Funded',
  rejected: 'Not funded',
  expired: 'Expired',
};

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';

const Arrow = () => (
  <div className={styles.arrow} aria-hidden="true">
    <svg viewBox="0 0 40 8" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 4H36M36 4L32 1M36 4L32 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </div>
);

const FundingFlow: React.FC<FundingFlowProps> = ({
  proposer,
  requestedUsd,
  recipient,
  outcome,
}) => {
  const hasRecipient = !!recipient && recipient.toLowerCase() !== ZERO_ADDR;
  const proposerName = proposer.username ? `@${proposer.username}` : shortAddr(proposer.walletAddress);
  const proposerInitial = (proposer.username?.[0] || proposer.walletAddress?.replace(/^0x/i, '')[0] || '?').toUpperCase();

  return (
    <div className={styles.flow} aria-label="Funding flow">
      {/* 1. Proposer */}
      <div className={styles.node}>
        {proposer.avatarUrl ? (
          <Image src={proposer.avatarUrl} alt={proposerName} width={40} height={40} className={styles.avatar} unoptimized />
        ) : (
          <div className={`${styles.avatar} ${styles.initialAvatar}`}>{proposerInitial}</div>
        )}
        <span className={styles.role}>Proposer</span>
        <span className={styles.value} title={proposer.walletAddress}>{proposerName}</span>
      </div>

      <Arrow />

      {/* 2. Requested amount (from the treasury) */}
      <div className={styles.node}>
        <div className={`${styles.avatar} ${styles.treasuryAvatar}`}>
          <Image src="/icons/logo-mwa.png" alt="MWA Treasury" width={28} height={28} unoptimized />
        </div>
        <span className={styles.role}>Requested</span>
        <span className={styles.value}>{usd(requestedUsd)}</span>
      </div>

      <Arrow />

      {/* 3. Recipient + outcome */}
      <div className={styles.node}>
        {hasRecipient ? (
          <div className={`${styles.avatar} ${styles.recipientAvatar}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M21 8v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8M3 8l9 5 9-5M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        ) : (
          <div className={`${styles.avatar} ${styles.blankAvatar}`} aria-label="No recipient" />
        )}
        <span className={styles.role}>Recipient</span>
        <span className={styles.value} title={recipient || undefined}>
          {hasRecipient ? shortAddr(recipient as string) : 'Not set'}
        </span>
        <span className={`${styles.outcome} ${styles[`outcome_${outcome}`]}`}>{OUTCOME_LABEL[outcome]}</span>
      </div>
    </div>
  );
};

export default FundingFlow;
