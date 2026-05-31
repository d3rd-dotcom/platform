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
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Balance details">
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} weight="bold" />
        </button>

        <section className={styles.rewardList} aria-label="Balance definitions">
          <dl className={styles.rewardLedger}>
            <div className={styles.reward}>
              <dt>Credits</dt>
              <dd>Earned through quests, lessons, and check-ins. Spend on Blue and Academy rewards.</dd>
            </div>
            <div className={styles.reward}>
              <dt>Cakes</dt>
              <dd>Awarded for participation and streaks. Used for governance and future drops.</dd>
            </div>
            <div className={styles.reward}>
              <dt>USDC</dt>
              <dd>Quest payouts sent to your connected wallet. Requires Academic Angel membership.</dd>
            </div>
            <div className={styles.reward}>
              <dt>Membership</dt>
              <dd>
                {membership === 'Staff' && 'Staff / VIP — access to gated tools and review workflows.'}
                {membership === 'Angel' && 'Academic Angel — eligible to request USDC quest payouts.'}
                {(membership === 'Guest' || membership === null) && 'Guest — take the course and earn credits through Academy activity.'}
              </dd>
            </div>
          </dl>
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
