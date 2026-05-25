'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X } from '@phosphor-icons/react';
import styles from './BalanceGuideModal.module.css';

type MembershipTier = 'Guest' | 'Angel' | 'Staff';

interface BalanceGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  membership: MembershipTier | null;
}

const membershipOptions = [
  {
    id: 'Guest' as MembershipTier,
    name: 'Guest',
    description: 'Take the course and earn credits through Academy activity.',
  },
  {
    id: 'Angel' as MembershipTier,
    name: 'Academic Angel',
    description: 'Hold an Angel NFT to request eligible USDC quest payouts.',
  },
  {
    id: 'Staff' as MembershipTier,
    name: 'Staff / VIP',
    description: 'Hold the VIP Membership Card to access gated tools and review workflows.',
  },
];

export default function BalanceGuideModal({
  isOpen,
  onClose,
  membership,
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
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Credits, tickets, and membership details">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>

        <section className={styles.membership} aria-label="Membership statuses">
          <span className={styles.sectionLabel}>Membership</span>
          <div className={styles.tierList}>
            {membershipOptions.map((option, index) => {
              const current = membership === option.id;
              return (
                <div className={`${styles.tier} ${current ? styles.tierCurrent : ''}`} key={option.id}>
                  <span className={styles.tierIndex}>{String(index + 1).padStart(2, '0')}</span>
                  <div className={styles.tierText}>
                    <strong>{option.name}</strong>
                    <p>{option.description}</p>
                  </div>
                  {current && <span className={styles.currentBadge}>Current</span>}
                </div>
              );
            })}
          </div>
        </section>

        <section className={styles.rewardList} aria-label="Balance definitions">
          <span className={styles.sectionLabel}>Balances</span>
          <dl className={styles.rewardLedger}>
            <div className={styles.reward}>
              <dt>Credits</dt>
              <dd>Earn through quests, course milestones, surveys, and check-ins. Spend on Blue and Academy rewards.</dd>
            </div>
            <div className={styles.reward}>
              <dt>Tickets</dt>
              <dd>Governance weight from your connected wallet. The balance is zero until voting power is available.</dd>
            </div>
            <div className={styles.reward}>
              <dt>USDC</dt>
              <dd>Dollar-denominated payouts sent to your connected wallet after approval.</dd>
            </div>
          </dl>
        </section>

        <section className={styles.redeem}>
          <span className={styles.sectionLabel}>USDC payouts</span>
          <ol className={styles.steps}>
            <li>Complete an eligible quest while holding an Academic Angel NFT.</li>
            <li>Request a payout. Staff reviews it; Blue sends approved USDC to your connected wallet.</li>
            <li>Move received USDC through a compatible exchange or off-ramp to withdraw cash.</li>
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
