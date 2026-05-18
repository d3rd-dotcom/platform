'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import styles from './ProMembershipModal.module.css';

interface ProMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Screen = 'intro' | 'purchase' | 'transfer';
type TransferPhase = 'working' | 'done' | 'failed';

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise: Promise<Stripe | null> | null = PUBLISHABLE_KEY
  ? loadStripe(PUBLISHABLE_KEY)
  : null;

const BLUE_AVATAR = '/uploads/blueagent.png';
const MEMBERSHIP_IMAGE = '/uploads/soul-key-membership.png';
const EXXIE_IMAGE = '/exxie.png';
const PRICE_LABEL = '$89.90';
const OPENSEA_URL =
  'https://opensea.io/item/base/0x5da79055cf8ca6482c997df58822e08e5707d6fc/1';

const FEATURES = [
  'One payment, lifetime access',
  'Every lesson and tool we build',
  'Lifetime magazine subscription',
  'A learning path shaped around you',
];

/* ── Checkout form (must render inside <Elements>) ───────────────────────── */

function CheckoutForm({ onPaid }: { onPaid: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setError(null);

    const { error: payError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (payError) {
      setError(payError.message || 'Payment could not be completed.');
      setSubmitting(false);
      return;
    }

    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onPaid();
      return;
    }

    setError('Payment did not complete. Please try again.');
    setSubmitting(false);
  };

  return (
    <form className={styles.checkoutForm} onSubmit={handleSubmit}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className={styles.formError}>{error}</p>}
      <button
        type="submit"
        className={`${styles.ctaButton} ${styles.ctaButtonBuy}`}
        disabled={!stripe || submitting}
      >
        <span>{submitting ? 'Processing...' : `Pay ${PRICE_LABEL}`}</span>
      </button>
    </form>
  );
}

/* ── Transfer animation stage ────────────────────────────────────────────── */

function TransferStage({
  phase,
  userAvatar,
}: {
  phase: TransferPhase;
  userAvatar: string | null;
}) {
  const settled = phase === 'done';

  return (
    <div className={styles.transferStage}>
      <svg className={styles.flowSvg} viewBox="0 0 100 100" preserveAspectRatio="none">
        <line
          x1="16"
          y1="16"
          x2="78"
          y2="80"
          className={`${styles.flowLine} ${settled ? styles.flowLineSettled : ''}`}
        />
      </svg>

      {/* Blue — top left */}
      <div className={`${styles.node} ${styles.nodeBlue}`}>
        <img src={BLUE_AVATAR} alt="Blue" />
      </div>

      {/* Human — bottom right */}
      <div className={`${styles.node} ${styles.nodeUser}`}>
        {userAvatar ? (
          <img src={userAvatar} alt="You" />
        ) : (
          <div className={styles.nodeFallback}>You</div>
        )}
        {settled && (
          <motion.div
            className={styles.nodeCheck}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M13.5 4.5L6.5 11.5L2.5 7.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}
      </div>

      {/* The membership card travelling along the line */}
      <motion.div
        className={styles.travelCard}
        initial={{ left: '13%', top: '11%', opacity: 0, scale: 0.7 }}
        animate={
          settled
            ? { left: '63%', top: '63%', opacity: 1, scale: 0.92 }
            : {
                left: ['13%', '63%'],
                top: ['11%', '63%'],
                opacity: [0, 1, 1, 0],
                scale: [0.7, 1, 1, 0.85],
              }
        }
        transition={
          settled
            ? { duration: 0.55, ease: 'easeOut' }
            : { duration: 2.1, repeat: Infinity, ease: 'easeInOut', times: [0, 0.2, 0.8, 1] }
        }
      >
        <img src={MEMBERSHIP_IMAGE} alt="VIP Membership" />
      </motion.div>
    </div>
  );
}

/* ── Modal ───────────────────────────────────────────────────────────────── */

const ProMembershipModal: React.FC<ProMembershipModalProps> = ({ isOpen, onClose }) => {
  const { getAccessToken } = usePrivy();

  const [screen, setScreen] = useState<Screen>('intro');
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [intentError, setIntentError] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [transferPhase, setTransferPhase] = useState<TransferPhase>('working');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [getAccessToken]);

  // Reset everything when the modal is closed.
  useEffect(() => {
    if (!isOpen) {
      setScreen('intro');
      setClientSecret(null);
      setOrderId(null);
      setIntentError(null);
      setTransferPhase('working');
      setTransferError(null);
      setTxHash(null);
    }
  }, [isOpen]);

  // Close on escape, lock body scroll.
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Load the buyer's avatar for the transfer screen.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data?.user?.avatarUrl) setUserAvatar(data.user.avatarUrl);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Open a payment intent when the user moves to the purchase screen.
  const startCheckout = useCallback(async () => {
    setScreen('purchase');
    if (clientSecret || intentLoading) return;

    setIntentLoading(true);
    setIntentError(null);
    try {
      const res = await fetch('/api/membership/create-intent', {
        method: 'POST',
        credentials: 'include',
        headers: await authHeaders(),
      });
      const data = await res.json();
      if (!res.ok) {
        setIntentError(data?.error || 'Could not start checkout.');
        return;
      }
      setClientSecret(data.clientSecret);
      setOrderId(data.orderId);
    } catch {
      setIntentError('Could not reach the payment service.');
    } finally {
      setIntentLoading(false);
    }
  }, [clientSecret, intentLoading, authHeaders]);

  // Poll order status while the transfer screen is showing.
  useEffect(() => {
    if (screen !== 'transfer' || !orderId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/membership/order-status?orderId=${encodeURIComponent(orderId)}`,
          { credentials: 'include', headers: await authHeaders() },
        );
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'transferred') {
          setTxHash(data.txHash || null);
          setTransferPhase('done');
          return;
        }
        if (data.status === 'failed' || data.status === 'expired') {
          setTransferError(
            data.error || 'The transfer hit a snag. Our team has been notified.',
          );
          setTransferPhase('failed');
          return;
        }
      } catch {
        /* keep polling through transient errors */
      }
      if (!cancelled) timer = setTimeout(poll, 3000);
    };

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [screen, orderId, authHeaders]);

  if (!isOpen) return null;

  const elementsOptions = clientSecret
    ? {
        clientSecret,
        appearance: {
          theme: 'flat' as const,
          variables: { colorPrimary: '#5168FF', borderRadius: '4px' },
        },
      }
    : undefined;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* ── Screen 1: VIP intro ───────────────────────────────────────── */}
        {screen === 'intro' && (
          <div className={styles.content}>
            <div className={styles.imageWrapper}>
              <Image
                src={MEMBERSHIP_IMAGE}
                alt="VIP Membership card"
                width={1050}
                height={655}
                className={styles.membershipImage}
                priority
              />
            </div>

            <div className={styles.textContent}>
              <span className={styles.badge}>VIP Membership</span>
              <h2 className={styles.title}>Become a Member</h2>
              <p className={styles.description}>
                Mental Wealth Academy is a research cohort built like a club,
                not a classroom. One membership unlocks the path to excellence.
              </p>

              <ul className={styles.featureList}>
                {FEATURES.map((feature) => (
                  <li key={feature} className={styles.featureItem}>
                    <svg
                      className={styles.checkIcon}
                      width="16"
                      height="16"
                      viewBox="0 0 16 16"
                      fill="none"
                    >
                      <path
                        d="M13.5 4.5L6.5 11.5L2.5 7.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                className={`${styles.ctaButton} ${styles.ctaButtonBuy}`}
                onClick={startCheckout}
              >
                <span>Continue · {PRICE_LABEL}</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Screen 2: Purchase ────────────────────────────────────────── */}
        {screen === 'purchase' && (
          <div className={styles.content}>
            <button
              className={styles.backLink}
              onClick={() => setScreen('intro')}
              type="button"
            >
              Back
            </button>
            <div className={styles.imageWrapper}>
              <Image
                src={EXXIE_IMAGE}
                alt="Exxie"
                width={1068}
                height={1473}
                className={styles.exxieImage}
              />
            </div>
            <div className={styles.textContent}>
              <h2 className={styles.title}>Checkout</h2>
              <p className={styles.description}>
                VIP Membership. Lifetime access, charged once.
              </p>

              <div className={styles.priceRow}>
                <span className={styles.priceLabel}>Total</span>
                <span className={styles.priceValue}>{PRICE_LABEL}</span>
              </div>

              {!stripePromise && (
                <p className={styles.formError}>
                  Payments are not configured. Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.
                </p>
              )}

              {intentError && <p className={styles.formError}>{intentError}</p>}

              {stripePromise && intentLoading && (
                <p className={styles.loadingText}>Preparing secure checkout...</p>
              )}

              {stripePromise && clientSecret && elementsOptions && (
                <Elements stripe={stripePromise} options={elementsOptions}>
                  <CheckoutForm onPaid={() => setScreen('transfer')} />
                </Elements>
              )}

              <p className={styles.secureNote}>Payments secured by Stripe.</p>
            </div>
          </div>
        )}

        {/* ── Screen 3: Transfer ────────────────────────────────────────── */}
        {screen === 'transfer' && (
          <div className={styles.content}>
            <div className={styles.textContent}>
              <h2 className={styles.title}>
                {transferPhase === 'done'
                  ? 'Welcome, member'
                  : transferPhase === 'failed'
                    ? 'Transfer delayed'
                    : 'Blue is sending your membership'}
              </h2>
              <p className={styles.description}>
                {transferPhase === 'done'
                  ? 'Your VIP Membership NFT is now in your wallet.'
                  : transferPhase === 'failed'
                    ? transferError
                    : 'Payment confirmed. Your membership card is moving from Blue to your wallet.'}
              </p>

              <TransferStage phase={transferPhase} userAvatar={userAvatar} />

              <AnimatePresence>
                {transferPhase === 'done' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={styles.transferActions}
                  >
                    {txHash && (
                      <a
                        className={styles.txLink}
                        href={`https://basescan.org/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View transaction
                      </a>
                    )}
                    <button className={styles.ctaButton} onClick={onClose}>
                      <span>Done</span>
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {transferPhase === 'failed' && (
                <div className={styles.transferActions}>
                  <a
                    className={styles.txLink}
                    href={OPENSEA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View collection on OpenSea
                  </a>
                  <button className={styles.ctaButton} onClick={onClose}>
                    <span>Close</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProMembershipModal;
