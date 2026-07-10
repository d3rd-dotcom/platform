'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  ArrowDown,
  ArrowRight,
  ArrowSquareOut,
  ArrowsClockwise,
  CircleNotch,
  PaperPlaneTilt,
  X,
} from '@phosphor-icons/react';
import {
  concat,
  createPublicClient,
  erc20Abi,
  formatUnits,
  http,
  isAddress,
  numberToHex,
  parseUnits,
  size,
  type Address,
} from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useWalletClient } from 'wagmi';
import CtaButton from '@/components/shared/CtaButton';
import { getChainConfig } from '@/lib/chain-config';
import type {
  SerializedSwapQuote,
  TreasurySwapAsset,
  TreasurySwapQuote,
  TreasurySwapQuoteRequest,
} from '@/lib/treasury-swap-types';
import styles from './TreasurySwapModal.module.css';

interface TreasurySwapModalProps {
  open: boolean;
  onClose: () => void;
}

interface AssetMeta {
  label: string;
  shortLabel: string;
  icon: string;
  decimals: number;
}

const ASSETS: Record<TreasurySwapAsset, AssetMeta> = {
  bitcoin: {
    label: 'Bitcoin',
    shortLabel: 'Bitcoin',
    icon: '/tokens/cbbtc.webp',
    decimals: 8,
  },
  diamonds: {
    label: 'Diamonds',
    shortLabel: 'Diamonds',
    icon: '/icons/ui-diamond.svg',
    decimals: 18,
  },
  eth: {
    label: 'ETH',
    shortLabel: 'ETH',
    icon: '/tokens/eth.png',
    decimals: 18,
  },
};

const QUICK_ROUTES: Array<{
  from: TreasurySwapAsset;
  to: TreasurySwapAsset;
}> = [
  { from: 'bitcoin', to: 'eth' },
  { from: 'bitcoin', to: 'diamonds' },
  { from: 'diamonds', to: 'bitcoin' },
];

function transactionError(error: unknown): string {
  if (error && typeof error === 'object') {
    const candidate = error as { shortMessage?: string; message?: string; code?: number };
    if (candidate.code === 4001) return 'Transaction canceled.';
    if (candidate.shortMessage) return candidate.shortMessage;
    if (candidate.message?.toLowerCase().includes('user rejected')) return 'Transaction canceled.';
  }
  return 'The transaction could not be completed. Check your balance and network.';
}

function displayAmount(value: string, decimals: number, maximumFractionDigits = 8): string {
  const formatted = formatUnits(BigInt(value), decimals);
  const numeric = Number(formatted);
  if (!Number.isFinite(numeric)) return formatted;
  return numeric.toLocaleString('en-US', { maximumFractionDigits });
}

export default function TreasurySwapModal({ open, onClose }: TreasurySwapModalProps) {
  const cfg = getChainConfig();
  const { address } = useAccount();
  const { getAccessToken } = usePrivy();
  const { data: walletClient } = useWalletClient();
  const [fromAsset, setFromAsset] = useState<TreasurySwapAsset>('bitcoin');
  const [toAsset, setToAsset] = useState<TreasurySwapAsset>('eth');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<TreasurySwapQuote | null>(null);
  const [swapState, setSwapState] = useState<'idle' | 'quoting' | 'approving' | 'signing' | 'swapping' | 'success'>('idle');
  const [swapError, setSwapError] = useState('');
  const [swapHash, setSwapHash] = useState<string | null>(null);
  const [showSend, setShowSend] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'success'>('idle');
  const [sendError, setSendError] = useState('');
  const [sendHash, setSendHash] = useState<string | null>(null);

  const isMainnet = cfg.chainId === base.id;
  const publicClient = useMemo(() => {
    const chain = cfg.chainId === baseSepolia.id ? baseSepolia : base;
    return createPublicClient({ chain, transport: http(cfg.rpcUrl) });
  }, [cfg.chainId, cfg.rpcUrl]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  useEffect(() => {
    setQuote(null);
    setSwapError('');
    setSwapHash(null);
    if (swapState !== 'success') setSwapState('idle');
  }, [amount, fromAsset, toAsset, swapState]);

  useEffect(() => {
    if (open) return;
    setShowSend(false);
    setQuote(null);
    setSwapError('');
    setSwapState('idle');
    setSwapHash(null);
    setSendError('');
    setSendState('idle');
    setSendHash(null);
  }, [open]);

  const selectRoute = (from: TreasurySwapAsset, to: TreasurySwapAsset) => {
    setFromAsset(from);
    setToAsset(to);
    setShowSend(false);
  };

  const flipAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
  };

  const fetchQuote = async (): Promise<TreasurySwapQuote> => {
    if (!address) throw new Error('Connect your wallet before requesting a quote.');
    const token = await getAccessToken();
    const body: TreasurySwapQuoteRequest = {
      fromAsset,
      toAsset,
      amount: amount.trim(),
      taker: address,
    };
    const response = await fetch('/api/treasury/swap/quote', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || 'Swap quote is temporarily unavailable.');
    }
    return data as TreasurySwapQuote;
  };

  const reviewSwap = async (event: React.FormEvent) => {
    event.preventDefault();
    setSwapError('');
    setSwapHash(null);
    if (!isMainnet) {
      setSwapError('Swaps activate when the app switches to Base mainnet.');
      return;
    }
    if (!amount.trim()) {
      setSwapError('Enter an amount to swap.');
      return;
    }

    setSwapState('quoting');
    try {
      const nextQuote = await fetchQuote();
      setQuote(nextQuote);
      setSwapState('idle');
      if (!nextQuote.liquidityAvailable) {
        setSwapError('No Base liquidity is available for this route.');
      }
    } catch (error) {
      setSwapState('idle');
      setSwapError(transactionError(error));
    }
  };

  const getFromTokenAddress = (): Address | null => {
    if (fromAsset === 'eth') return null;
    const configured = fromAsset === 'bitcoin' ? cfg.cbBTcAddress : cfg.diamondsTokenAddress;
    return configured && isAddress(configured) ? configured : null;
  };

  const executeSwap = async () => {
    if (!quote?.liquidityAvailable || !walletClient || !address) {
      setSwapError('Connect your wallet and request a fresh quote.');
      return;
    }
    if (walletClient.chain.id !== base.id) {
      setSwapError('Switch your wallet to Base.');
      return;
    }
    if (quote.issues.balance) {
      setSwapError(`Your wallet needs more ${ASSETS[fromAsset].label} for this swap.`);
      return;
    }

    setSwapError('');
    setSwapHash(null);
    try {
      const fromToken = getFromTokenAddress();
      if (fromToken && quote.issues.allowance) {
        const required = BigInt(quote.fromAmount);
        const current = BigInt(quote.issues.allowance.currentAllowance);
        if (current < required) {
          setSwapState('approving');
          const approvalHash = await walletClient.writeContract({
            address: fromToken,
            abi: erc20Abi,
            functionName: 'approve',
            args: [quote.issues.allowance.spender as Address, required],
          });
          const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash });
          if (approvalReceipt.status !== 'success') throw new Error('Approval reverted');
        }
      }

      setSwapState('quoting');
      const freshQuote = await fetchQuote();
      setQuote(freshQuote);
      if (!freshQuote.liquidityAvailable) {
        throw new Error('No Base liquidity is available for this route.');
      }
      if (freshQuote.issues.balance) {
        throw new Error(`Your wallet needs more ${ASSETS[fromAsset].label} for this swap.`);
      }
      if (
        freshQuote.issues.allowance
        && BigInt(freshQuote.issues.allowance.currentAllowance) < BigInt(freshQuote.fromAmount)
      ) {
        throw new Error('Token approval has not reached Base yet. Request a fresh quote.');
      }

      let transactionData = freshQuote.transaction.data;
      if (freshQuote.permit2?.eip712) {
        setSwapState('signing');
        const typedData = freshQuote.permit2.eip712;
        const signature = await walletClient.signTypedData({
          account: walletClient.account,
          domain: typedData.domain,
          types: typedData.types,
          primaryType: typedData.primaryType,
          message: typedData.message,
        } as Parameters<typeof walletClient.signTypedData>[0]);
        const signatureLength = numberToHex(size(signature), {
          signed: false,
          size: 32,
        });
        transactionData = concat([transactionData, signatureLength, signature]);
      }

      setSwapState('swapping');
      const hash = await walletClient.sendTransaction({
        account: walletClient.account,
        to: freshQuote.transaction.to as Address,
        data: transactionData,
        value: BigInt(freshQuote.transaction.value),
        gas: BigInt(freshQuote.transaction.gas),
        gasPrice: BigInt(freshQuote.transaction.gasPrice),
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Swap reverted');
      setSwapHash(hash);
      setSwapState('success');
    } catch (error) {
      setSwapState('idle');
      setSwapError(transactionError(error));
    }
  };

  const sendBitcoin = async (event: React.FormEvent) => {
    event.preventDefault();
    setSendError('');
    setSendHash(null);

    if (!address || !walletClient) {
      setSendError('Connect your wallet before sending Bitcoin.');
      return;
    }
    if (!cfg.cbBTcAddress || !isAddress(cfg.cbBTcAddress)) {
      setSendError('Bitcoin is unavailable on this network.');
      return;
    }
    if (!isAddress(recipient)) {
      setSendError('Enter a valid Base wallet address.');
      return;
    }

    let value: bigint;
    try {
      value = parseUnits(sendAmount.trim(), 8);
      if (value <= 0n) throw new Error('Amount must be positive');
    } catch {
      setSendError('Enter a Bitcoin amount greater than zero.');
      return;
    }
    if (walletClient.chain.id !== cfg.chainId) {
      setSendError(`Switch your wallet to ${cfg.chainName}.`);
      return;
    }

    setSendState('sending');
    try {
      const hash = await walletClient.writeContract({
        address: cfg.cbBTcAddress,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as Address, value],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Transaction reverted');
      setSendHash(hash);
      setSendState('success');
      setSendAmount('');
    } catch (error) {
      setSendState('idle');
      setSendError(transactionError(error));
    }
  };

  const swapBusy = !['idle', 'success'].includes(swapState);
  const quoteReady = quote?.liquidityAvailable === true;
  const swapButtonLabel = {
    idle: quoteReady ? 'Swap with Base' : 'Review swap',
    quoting: 'Finding the best route',
    approving: `Approve ${ASSETS[fromAsset].label}`,
    signing: 'Sign swap permit',
    swapping: 'Confirming swap',
    success: 'Swap complete',
  }[swapState];

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.overlay} onMouseDown={onClose}>
      <section
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="treasury-swap-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Powered by Coinbase CDP</span>
            <h2 id="treasury-swap-title" className={styles.title}>Swap on Base</h2>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close swap">
            <X size={18} weight="bold" />
          </button>
        </header>

        <div className={styles.body}>
          <p className={styles.intro}>
            CDP searches Base liquidity and shows the minimum received before your wallet signs.
          </p>

          <div className={styles.routeGrid}>
            {QUICK_ROUTES.map((route) => {
              const active = !showSend && fromAsset === route.from && toAsset === route.to;
              return (
                <button
                  key={`${route.from}-${route.to}`}
                  type="button"
                  className={`${styles.routeCard} ${active ? styles.routeCardActive : ''}`}
                  onClick={() => selectRoute(route.from, route.to)}
                >
                  <span className={styles.routeAssets} aria-hidden="true">
                    <Image src={ASSETS[route.from].icon} alt="" width={28} height={28} />
                    <ArrowRight size={14} weight="bold" />
                    <Image src={ASSETS[route.to].icon} alt="" width={28} height={28} />
                  </span>
                  <span className={styles.routeText}>
                    <strong>{ASSETS[route.from].label} to {ASSETS[route.to].label}</strong>
                    <small>Base swap</small>
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              className={`${styles.routeCard} ${showSend ? styles.routeCardActive : ''}`}
              onClick={() => setShowSend((current) => !current)}
              aria-expanded={showSend}
              aria-controls="send-bitcoin-panel"
            >
              <span className={styles.sendRouteIcon} aria-hidden="true">
                <Image src="/tokens/cbbtc.webp" alt="" width={28} height={28} />
                <PaperPlaneTilt size={18} weight="fill" />
              </span>
              <span className={styles.routeText}>
                <strong>Send Bitcoin</strong>
                <small>To a Base wallet</small>
              </span>
            </button>
          </div>

          {!isMainnet && (
            <p className={styles.networkNote}>
              This build uses {cfg.chainName}. Coinbase Trade API routes activate on Base mainnet.
            </p>
          )}

          {!showSend && (
            <form className={styles.swapPanel} onSubmit={reviewSwap}>
              <div className={styles.assetInput}>
                <span className={styles.assetInputLabel}>You send</span>
                <div className={styles.assetInputRow}>
                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={swapBusy}
                    aria-label={`${ASSETS[fromAsset].label} amount`}
                  />
                  <span className={styles.assetChip}>
                    <Image src={ASSETS[fromAsset].icon} alt="" width={22} height={22} />
                    {ASSETS[fromAsset].shortLabel}
                  </span>
                </div>
              </div>

              <button type="button" className={styles.flipButton} onClick={flipAssets} aria-label="Reverse swap">
                <ArrowDown size={16} weight="bold" />
              </button>

              <div className={styles.assetInput}>
                <span className={styles.assetInputLabel}>You receive</span>
                <div className={styles.assetInputRow}>
                  <span className={styles.receiveAmount}>
                    {quoteReady
                      ? displayAmount(quote.toAmount, quote.toDecimals)
                      : '—'}
                  </span>
                  <span className={styles.assetChip}>
                    <Image src={ASSETS[toAsset].icon} alt="" width={22} height={22} />
                    {ASSETS[toAsset].shortLabel}
                  </span>
                </div>
              </div>

              {quoteReady && (
                <div className={styles.quoteDetails}>
                  <div>
                    <span>Minimum received</span>
                    <strong>{displayAmount(quote.minToAmount, quote.toDecimals)} {ASSETS[toAsset].shortLabel}</strong>
                  </div>
                  {quote.fees.gasFee && (
                    <div>
                      <span>Estimated network cost</span>
                      <strong>{displayAmount(quote.fees.gasFee.amount, 18, 6)} ETH</strong>
                    </div>
                  )}
                  <div>
                    <span>Slippage limit</span>
                    <strong>1%</strong>
                  </div>
                </div>
              )}

              {swapError && <p className={styles.sendError} role="alert">{swapError}</p>}
              {swapState === 'success' && swapHash && (
                <a
                  className={styles.sendSuccess}
                  href={`${cfg.explorerUrl}/tx/${swapHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Swap confirmed. View transaction
                  <ArrowSquareOut size={14} weight="bold" />
                </a>
              )}

              {quoteReady ? (
                <CtaButton
                  type="button"
                  block
                  disabled={swapBusy || !isMainnet}
                  onClick={() => void executeSwap()}
                >
                  {swapBusy && <CircleNotch size={16} className={styles.spinner} />}
                  {swapButtonLabel}
                </CtaButton>
              ) : (
                <CtaButton type="submit" block disabled={swapBusy || !isMainnet}>
                  {swapState === 'quoting'
                    ? <CircleNotch size={16} className={styles.spinner} />
                    : <ArrowsClockwise size={16} weight="bold" />}
                  {swapButtonLabel}
                </CtaButton>
              )}
            </form>
          )}

          {showSend && (
            <form id="send-bitcoin-panel" className={styles.sendPanel} onSubmit={sendBitcoin}>
              <div className={styles.sendPanelHeader}>
                <Image src="/tokens/cbbtc.webp" alt="" width={24} height={24} />
                <div>
                  <strong>Send Bitcoin</strong>
                  <span>Transfers Bitcoin on {cfg.chainName}.</span>
                </div>
              </div>

              <label className={styles.field}>
                <span>Recipient</span>
                <input
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  placeholder="0x..."
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>

              <label className={styles.field}>
                <span>Amount</span>
                <div className={styles.amountInput}>
                  <input
                    value={sendAmount}
                    onChange={(event) => setSendAmount(event.target.value)}
                    placeholder="0.00000000"
                    inputMode="decimal"
                    autoComplete="off"
                  />
                  <span>Bitcoin</span>
                </div>
              </label>

              {sendError && <p className={styles.sendError} role="alert">{sendError}</p>}
              {sendState === 'success' && sendHash && (
                <a
                  className={styles.sendSuccess}
                  href={`${cfg.explorerUrl}/tx/${sendHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Bitcoin sent. View transaction
                  <ArrowSquareOut size={14} weight="bold" />
                </a>
              )}

              <CtaButton type="submit" block disabled={sendState === 'sending'}>
                {sendState === 'sending' && <CircleNotch size={16} className={styles.spinner} />}
                {sendState === 'sending' ? 'Confirming transfer' : 'Review send'}
              </CtaButton>
            </form>
          )}

          <p className={styles.disclaimer}>
            Quotes use Coinbase CDP with 0x aggregation. Every approval, permit, swap, and transfer requires your wallet.
          </p>
        </div>
      </section>
    </div>,
    document.body,
  );
}
