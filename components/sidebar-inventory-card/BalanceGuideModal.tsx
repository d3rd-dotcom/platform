'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { X } from '@phosphor-icons/react';
import styles from './BalanceGuideModal.module.css';

type MembershipTier = 'Guest' | 'Angel' | 'Staff';

interface BalanceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: string;
  membership: MembershipTier | null;
  usdc: string;
  votingPower: string | null;
}

const membershipOptions = [
  {
    name: 'Guest',
    description: 'Take the course and earn credits through Academy activity.',
  },
  {
    name: 'Academic Angel',
    description: 'Hold an Angel NFT to request eligible USDC quest payouts.',
  },
  {
    name: 'Staff / VIP',
    description: 'Hold the VIP Membership Card to access gated tools and review workflows.',
  },
];

export default function BalanceGuideModal({
  isOpen,
  onClose,
  credits,
  membership,
  usdc,
  votingPower,
}: BalanceGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="balance-guide-title">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>

        <header className={styles.hero}>
          <span className={styles.eyebrow}>Your reward wallet</span>
          <h2 className={styles.title} id="balance-guide-title">Participation can pay.</h2>
          <p className={styles.subtitle}>
            Complete Academy work to earn credits. Qualifying Academic Angels can submit marked quests for USDC review.
          </p>
        </header>

        <div className={styles.snapshot} aria-label="Current balances">
          <div className={`${styles.snapshotCard} ${styles.creditsCard}`}>
            <Image src="/icons/ui-shard.svg" alt="" width={26} height={26} className={styles.creditsIcon} />
            <span className={styles.snapshotLabel}>Credits</span>
            <strong className={styles.snapshotValue}>{credits}</strong>
          </div>
          <div className={styles.snapshotCard}>
            <span className={styles.snapshotLabel}>Membership</span>
            <strong className={styles.snapshotValue}>{membership ?? '--'}</strong>
          </div>
          <div className={`${styles.snapshotCard} ${styles.usdcCard}`}>
            <span className={styles.snapshotLabel}>Wallet USDC</span>
            <strong className={styles.snapshotValue}>{usdc}</strong>
          </div>
          {votingPower && (
            <div className={styles.snapshotCard}>
              <span className={styles.snapshotLabel}>Votes</span>
              <strong className={styles.snapshotValue}>{votingPower}</strong>
            </div>
          )}
        </div>

        <div className={styles.sections}>
          <section className={styles.infoPanel}>
            <h3 className={styles.sectionTitle}>What balances mean</h3>
            <div className={styles.definition}>
              <strong>Credits</strong>
              <p>Earned through quests, course milestones, surveys, and check-ins. Spend them on Blue and Academy reward features.</p>
            </div>
            <div className={styles.definition}>
              <strong>USDC</strong>
              <p>A dollar-denominated token. Approved qualifying quest payouts are sent to your connected wallet.</p>
            </div>
            <div className={styles.definition}>
              <strong>Votes</strong>
              <p>Governance weight appears in your card only when your wallet holds voting power.</p>
            </div>
          </section>

          <section className={styles.infoPanel}>
            <h3 className={styles.sectionTitle}>Membership status</h3>
            <div className={styles.tierList}>
              {membershipOptions.map((option) => (
                <div className={styles.tier} key={option.name}>
                  <strong>{option.name}</strong>
                  <p>{option.description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className={styles.redeem}>
          <h3 className={styles.sectionTitle}>How USDC payouts work</h3>
          <ol className={styles.steps}>
            <li>Complete an eligible quest while holding an Academic Angel NFT.</li>
            <li>Request the USDC payout. Staff reviews the submission and Blue sends approved USDC to your wallet.</li>
            <li>Transfer received USDC to a compatible exchange or off-ramp to withdraw cash. Provider and network fees may apply.</li>
          </ol>
        </section>

        <div className={styles.actions}>
          <Link href="/quests" className={styles.primaryAction} onClick={onClose}>Explore quests</Link>
          <button type="button" className={styles.secondaryAction} onClick={onClose}>Close</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
