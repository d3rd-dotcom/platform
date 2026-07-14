'use client';

/* eslint-disable @next/next/no-img-element */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccount } from 'wagmi';
import { providers } from 'ethers';
import { getEligibleInviteLists, getMintTransaction, SCATTER_COLLECTION_SLUG } from '@/lib/scatter-api';
import { useSound } from '@/hooks/useSound';
import CtaButton from '@/components/shared/CtaButton';
import styles from './AngelUpsellModal.module.css';

interface AngelUpsellModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MintPhase = 'idle' | 'loading' | 'minting' | 'success' | 'error';

const ANGEL_IMAGE = '/angel-upsell-mural.webp';

export default function AngelUpsellModal({ isOpen, onClose }: AngelUpsellModalProps) {
  const { play } = useSound();
  const { address, isConnected, connector } = useAccount();
  const [phase, setPhase] = useState<MintPhase>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

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

  useEffect(() => {
    if (isOpen) setPhase('idle');
  }, [isOpen]);

  const handleMint = async () => {
    if (!isConnected || !address || !connector) {
      setErrorMsg('Please connect your wallet first');
      setPhase('error');
      return;
    }

    try {
      setPhase('loading');
      setErrorMsg(null);

      const res = await fetch('/api/scatter/collection');
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to fetch collection info');
      }
      const collectionInfo = await res.json();
      if (!collectionInfo.address) throw new Error('Collection address not found');

      const collectionAddress = collectionInfo.address as string;
      const collectionChainId = (collectionInfo.chainId || 8453) as number;

      const lists = await getEligibleInviteLists({
        collectionSlug: SCATTER_COLLECTION_SLUG,
        walletAddress: address,
      });

      if (!Array.isArray(lists) || lists.length === 0) {
        throw new Error('No eligible purchase options found');
      }

      const selectedList = lists[0];

      setPhase('minting');

      const mintResponse = await getMintTransaction({
        collectionAddress,
        chainId: collectionChainId,
        minterAddress: address,
        lists: [{ id: selectedList.id, quantity: 1 }],
      });

      const provider = await connector.getProvider() as any;
      if (!provider) throw new Error('Provider not available from connector');

      const ethersProvider = new providers.Web3Provider(provider);
      const signer = ethersProvider.getSigner();

      try {
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${collectionChainId.toString(16)}` }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902 && collectionChainId === 8453) {
          await provider.request({
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

      const tx = await signer.sendTransaction({
        to: mintResponse.mintTransaction.to,
        value: mintResponse.mintTransaction.value,
        data: mintResponse.mintTransaction.data,
      });

      setTxHash(tx.hash);
      await tx.wait();
      setPhase('success');
    } catch (err) {
      console.error('Mint error:', err);
      setErrorMsg(err instanceof Error ? err.message : 'Failed to purchase');
      setPhase('error');
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  // Portal to <body> so a transformed ancestor can't trap the fixed overlay.
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="angel-upsell-title"
      >
        <div className={styles.imageSection}>
          <img src={ANGEL_IMAGE} alt="Academic Angel" className={styles.angelImage} />
          <button className={styles.closeButton} onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
              <path
                d="M15 5L5 15M5 5L15 15"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className={styles.body}>
          {(phase === 'idle' || phase === 'error') && (
            <h2 id="angel-upsell-title" className={styles.title}>
              You need an Angel to play this game
            </h2>
          )}

          {phase === 'idle' && (
            <CtaButton
              block
              onClick={() => { play('click'); handleMint(); }}
              onMouseEnter={() => play('hover')}
            >
              Mint your Angel
            </CtaButton>
          )}

          {phase === 'loading' && (
            <div className={styles.statusContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.statusText}>Preparing your purchase...</p>
            </div>
          )}

          {phase === 'minting' && (
            <div className={styles.statusContainer}>
              <div className={styles.spinner}></div>
              <p className={styles.statusText}>Confirm transaction in your wallet...</p>
            </div>
          )}

          {phase === 'success' && (
            <div className={styles.successContainer}>
              <p className={styles.successTitle}>Welcome to the Tribe</p>
              <p className={styles.successMessage}>Your angel is on its way</p>
              {txHash && (
                <a
                  href={`https://basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.txLink}
                  onClick={() => play('navigation')}
                  onMouseEnter={() => play('hover')}
                >
                  View on BaseScan
                </a>
              )}
              <CtaButton
                variant="secondary"
                onClick={() => { play('click'); onClose(); }}
                onMouseEnter={() => play('hover')}
              >
                Close
              </CtaButton>
            </div>
          )}

          {phase === 'error' && (
            <div className={styles.errorContainer}>
              <p className={styles.errorText}>{errorMsg}</p>
              <CtaButton
                block
                onClick={() => { play('click'); handleMint(); }}
                onMouseEnter={() => play('hover')}
              >
                Try again
              </CtaButton>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
