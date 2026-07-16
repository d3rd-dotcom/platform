'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import { usePrivy } from '@privy-io/react-auth';
import {
  SCATTER_COLLECTION_SLUG,
  getEligibleInviteLists,
  getMintTransaction,
  type MintList,
} from '@/lib/scatter-api';
import { useSound } from '@/hooks/useSound';
import dynamic from 'next/dynamic';
import CtaButton from '@/components/shared/CtaButton';
import styles from './MembershipSection.module.css';

const ProMembershipModal = dynamic(() => import('@/components/pro-membership-modal/ProMembershipModal'), { ssr: false });

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

export const MembershipSection: React.FC = () => {
  const { play } = useSound();
  const { ready, authenticated, login, getAccessToken } = usePrivy();
  const [isVisible, setIsVisible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showLifetimeCheckout, setShowLifetimeCheckout] = useState(false);
  const [monthlyCheckoutPending, setMonthlyCheckoutPending] = useState(false);
  const [monthlyCheckoutLoading, setMonthlyCheckoutLoading] = useState(false);
  const [monthlyCheckoutError, setMonthlyCheckoutError] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Scatter / mint state
  const [mintLists, setMintLists] = useState<MintList[]>([]);
  const [selectedList, setSelectedList] = useState<MintList | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [collectionAddress, setCollectionAddress] = useState<string | null>(null);
  const [collectionChainId, setCollectionChainId] = useState<number>(8453);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!showModal || selectedList || collectionAddress) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/scatter/collection');
        if (res.ok) {
          const info = await res.json();
          if (info.address) {
            setCollectionAddress(info.address);
            setCollectionChainId(info.chainId || 8453);
          }
        }
        const lists = await getEligibleInviteLists({
          collectionSlug: SCATTER_COLLECTION_SLUG,
        });
        if (Array.isArray(lists) && lists.length > 0) {
          setMintLists(lists);
          setSelectedList(lists[0]);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [collectionAddress, selectedList, showModal]);

  const handleMint = async () => {
    if (!selectedList || !collectionAddress) return;
    play('click');
    setMinting(true);
    setError(null);

    try {
      const ethereum = (window as any).ethereum;
      if (!ethereum) {
        throw new Error('Please install a Web3 wallet (e.g. MetaMask)');
      }

      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const minterAddress = accounts[0];

      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${collectionChainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 && collectionChainId === 8453) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x2105',
              chainName: 'Base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            }],
          });
        } else {
          throw switchError;
        }
      }

      const mintResponse = await getMintTransaction({
        collectionAddress,
        chainId: collectionChainId,
        minterAddress,
        lists: [{ id: selectedList.id, quantity }],
      });

      const hash = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: minterAddress,
          to: mintResponse.mintTransaction.to,
          value: mintResponse.mintTransaction.value,
          data: mintResponse.mintTransaction.data,
        }],
      });

      setTxHash(hash);
      setSuccess(true);
      play('celebration');
    } catch (err: any) {
      setError(err.message || 'Purchase failed');
      setTimeout(() => setError(null), 5000);
    } finally {
      setMinting(false);
    }
  };

  const openModal = useCallback(() => {
    play('click');
    setShowModal(true);
  }, [play]);

  const closeModal = useCallback(() => {
    play('click');
    setShowModal(false);
  }, [play]);

  const startMonthlyCheckout = useCallback(async () => {
    if (!ready || monthlyCheckoutLoading) return;
    play('click');
    setMonthlyCheckoutError(null);

    if (!authenticated) {
      setMonthlyCheckoutPending(true);
      login();
      return;
    }

    setMonthlyCheckoutPending(false);
    setMonthlyCheckoutLoading(true);
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/membership/create-subscription-session', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.url) {
        setMonthlyCheckoutError(data?.error || 'Could not start subscription checkout.');
        return;
      }
      window.location.assign(data.url);
    } catch {
      setMonthlyCheckoutError('Could not reach the payment service.');
    } finally {
      setMonthlyCheckoutLoading(false);
    }
  }, [authenticated, getAccessToken, login, monthlyCheckoutLoading, play, ready]);

  useEffect(() => {
    if (!authenticated || !monthlyCheckoutPending) return;
    void startMonthlyCheckout();
  }, [authenticated, monthlyCheckoutPending, startMonthlyCheckout]);

  useEffect(() => {
    if (!showModal) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [showModal, closeModal]);

  // Allow other sections to open the purchase modal
  useEffect(() => {
    const handler = () => setShowLifetimeCheckout(true);
    window.addEventListener('openPurchaseModal', handler);
    return () => window.removeEventListener('openPurchaseModal', handler);
  }, []);

  return (
    <section ref={sectionRef} id="membership" className={`${styles.section} ${isVisible ? styles.sectionVisible : ''}`}>
      <div className={styles.container}>
        <div className={styles.dinoWrap} aria-hidden="true">
          <div className={styles.dinoGlow} />
          <Image
            src="/images/dino-heart.png"
            alt=""
            width={1280}
            height={1280}
            className={styles.dino}
            sizes="(max-width: 768px) 88px, 132px"
          />
        </div>

        <div className={styles.comparisonPanel}>
          <div className={styles.tierGrid}>
          {/* Free Tier */}
          <div className={styles.tierCard}>
            <div className={styles.tierHeader}>
              <span className={styles.tierName}>Explorer</span>
              <div className={styles.tierPriceRow}>
                <span className={styles.tierPrice}>Free</span>
              </div>
              <p className={styles.tierDesc}>Access the core course and start building your practice.</p>
            </div>
            <div className={styles.tierDivider} />
            <ul className={styles.tierFeatures}>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                12-week course access
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Morning Pages journaling
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Weekly tasks and quests
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Community forum
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Credit rewards for study
              </li>
            </ul>
            <CtaButton
              type="button"
              variant="ghost"
              block
              className={`${styles.tierCta} ${styles.explorerCta}`}
              onClick={() => {
                play('click');
                window.location.assign('/dao');
              }}
              onMouseEnter={() => play('hover')}
            >
              Enter Free
            </CtaButton>
          </div>

          {/* Monthly Tier */}
          <div className={`${styles.tierCard} ${styles.tierCardPrimary}`}>
            <div className={styles.tierBadge}>Recommended</div>
            <div className={styles.tierHeader}>
              <span className={styles.tierName}>Member</span>
              <div className={styles.tierPriceRow}>
                <span className={styles.tierPrice}>$20</span>
                <span className={styles.tierPriceLabel}>/month</span>
              </div>
              <p className={styles.tierDesc}>Full access with research tools and Blue.</p>
            </div>
            <div className={styles.tierDivider} />
            <ul className={styles.tierFeatures}>
              <li className={styles.tierFeature}>
                <span className={`${styles.featureCheck} ${styles.featureCheckPrimary}`}><CheckIcon /></span>
                Everything in Explorer
              </li>
              <li className={styles.tierFeature}>
                <span className={`${styles.featureCheck} ${styles.featureCheckPrimary}`}><CheckIcon /></span>
                Submit proposals to the treasury
              </li>
              <li className={styles.tierFeature}>
                <span className={`${styles.featureCheck} ${styles.featureCheckPrimary}`}><CheckIcon /></span>
                DeSci research tools
              </li>
              <li className={styles.tierFeature}>
                <span className={`${styles.featureCheck} ${styles.featureCheckPrimary}`}><CheckIcon /></span>
                Blue AI co-pilot
              </li>
            </ul>
            <CtaButton
              type="button"
              variant="primary"
              block
              className={styles.tierCta}
              onClick={startMonthlyCheckout}
              onMouseEnter={() => play('hover')}
              disabled={!ready || monthlyCheckoutLoading}
            >
              {monthlyCheckoutLoading ? 'Opening checkout...' : 'Subscribe'}
            </CtaButton>
            {monthlyCheckoutError && <p className={styles.checkoutError}>{monthlyCheckoutError}</p>}
          </div>

          {/* Lifetime Tier */}
          <div className={`${styles.tierCard} ${styles.tierCardValue}`}>
            <div className={`${styles.tierBadge} ${styles.tierBadgeValue}`}>Best Value</div>
            <div className={styles.tierHeader}>
              <span className={styles.tierName}>Academic Angel</span>
              <div className={styles.tierPriceRow}>
                <span className={styles.tierPrice}>$888</span>
                <span className={styles.tierPriceLabel}>one-time</span>
              </div>
              <p className={styles.tierDesc}>Lifetime membership with on-chain ownership.</p>
            </div>
            <div className={styles.tierDivider} />
            <ul className={styles.tierFeatures}>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Everything in Member
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Lifetime access to all future cohorts
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                On-chain membership NFT
              </li>
              <li className={styles.tierFeature}>
                <span className={styles.featureCheck}><CheckIcon /></span>
                Treasury profit sharing
              </li>
            </ul>
            <CtaButton
              type="button"
              variant="secondary"
              block
              className={`${styles.tierCta} ${styles.lifetimeCta}`}
              onClick={() => {
                play('click');
                setShowLifetimeCheckout(true);
              }}
              onMouseEnter={() => play('hover')}
            >
              Purchase Membership
            </CtaButton>
          </div>
          </div>
        </div>

        <div className={styles.supportRow}>
          <p className={styles.supportCopy}>
            Spread the wealth! Payments help keep our platform free for others.
          </p>
        </div>

      </div>

      <ProMembershipModal
        isOpen={showLifetimeCheckout}
        onClose={() => setShowLifetimeCheckout(false)}
      />

      {/* Purchase Modal */}
      {showModal && typeof window !== 'undefined' && createPortal(
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Purchase Membership</h3>
              <button className={styles.modalClose} onClick={closeModal} aria-label="Close">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <span className={styles.price}>$888</span>
              <span className={styles.priceNote}>One-time membership</span>

              <div className={styles.divider} />

              <ul className={styles.benefitsList}>
                <li className={styles.benefitItem}>Join a creative community awakening minds through art, science, and spirit</li>
                <li className={styles.benefitItem}>Access funding pools for research, projects, and real-world impact</li>
                <li className={styles.benefitItem}>Lifetime entry to every course, cohort, and seasonal programme</li>
              </ul>

              <div className={styles.divider} />

              {success ? (
                <div className={styles.successBlock}>
                  <span className={styles.successText}>Welcome to the Academy.</span>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.txLink}
                    >
                      View receipt
                    </a>
                  )}
                </div>
              ) : (
                <button
                  className={styles.mintBtn}
                  onClick={handleMint}
                  disabled={minting || loading}
                >
                  {minting ? 'Processing...' : 'Confirm Purchase'}
                </button>
              )}

              {error && <p className={styles.error}>{error}</p>}
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
};

export default MembershipSection;
