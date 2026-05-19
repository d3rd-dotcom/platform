'use client';

/* eslint-disable @next/next/no-img-element */
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './WelcomePremiumModal.module.css';

const MEMBERSHIP_IMAGE = '/uploads/vip-membership-card.png';

interface WelcomePremiumModalProps {
  /** Called when the buyer dismisses the screen. */
  onClose: () => void;
}

/**
 * One-time celebratory screen shown after a buyer's VIP Membership NFT lands.
 * Presentational only — the gate decides when to show it and records dismissal.
 */
const WelcomePremiumModal: React.FC<WelcomePremiumModalProps> = ({ onClose }) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={styles.overlay}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <motion.div
        className={styles.modal}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 240, damping: 24 }}
      >
        <div className={styles.cardStage}>
          <motion.div
            className={styles.glow}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 0.9, 0.65], scale: [0.6, 1.05, 1] }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
          <motion.div
            className={styles.card}
            initial={
              reduceMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.7, rotate: -8 }
            }
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
          >
            <img src={MEMBERSHIP_IMAGE} alt="VIP Membership card" />
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
        >
          <span className={styles.badge}>VIP Membership</span>
          <h2 className={styles.title}>Welcome to Premium</h2>
          <p className={styles.description}>
            Your membership card is in your wallet and your access is live. Every
            lesson, every tool, and the magazine are now yours for life.
          </p>
          <button type="button" className={styles.button} onClick={onClose}>
            Start exploring
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default WelcomePremiumModal;
