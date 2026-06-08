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
  membership: MembershipTier | null;
  credits: string;
  cakes: string;
  usdc: string;
}

interface SlotDef {
  label: string;
  icon: string;
  unoptimized?: boolean;
  value: string;
  tooltip: string;
}

const EMPTY_VALUES = new Set(['0', '0.00', '000']);

export default function BalanceGuideModal({
  isOpen,
  onClose,
  membership,
  credits,
  cakes,
  usdc,
}: BalanceGuideModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  const tierFilled = membership === 'Angel' || membership === 'Staff';
  const tierLabel =
    membership === 'Staff' ? 'Staff / VIP' :
    membership === 'Angel' ? 'Academic Angel' : 'Guest';

  const slots: SlotDef[] = [
    { label: 'Diamonds',      icon: '/icons/ui-shard.svg',     value: credits,  tooltip: 'Earned through quests, lessons, and check-ins.' },
    { label: 'Cakes',        icon: '/icons/cake.webp',        value: cakes,    tooltip: 'Awarded for participation. Used for governance.', unoptimized: true },
    { label: 'USDC',         icon: '/icons/usdc-logo.svg',         value: usdc,     tooltip: 'Quest payouts sent to your connected wallet.', unoptimized: true },
    { label: 'Certificates', icon: '/icons/ui-seal.svg',      value: '0',      tooltip: 'Awarded for completing Academy milestones.' },
    { label: 'Badges',       icon: '/icons/badge-academy.png', value: '0',     tooltip: 'Earned for special achievements.', unoptimized: true },
    { label: 'Awards',       icon: '/icons/rewards.svg',      value: '0',      tooltip: 'Granted by staff for outstanding participation.' },
  ];

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <section className={styles.modal} role="dialog" aria-modal="true" aria-label="Inventory">
        <div className={styles.header}>
          <span className={styles.title}>Inventory</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={15} weight="bold" />
          </button>
        </div>

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

        <div className={`${styles.membershipSlot} ${tierFilled ? styles.membershipFilled : ''}`}>
          <Image src="/icons/governance.svg" alt="" width={16} height={16} className={styles.membershipIcon} />
          <div className={styles.membershipInfo}>
            <span className={styles.membershipMeta}>Membership</span>
            <span className={`${styles.membershipTier} ${tierFilled ? styles.membershipTierActive : ''}`}>
              {tierLabel}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/quests" className={styles.primaryAction} onClick={onClose}>Explore quests</Link>
          <button type="button" className={styles.secondaryAction} onClick={onClose}>Close</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
