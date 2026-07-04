'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { Contract, providers, utils } from 'ethers';
import { CaretLeft, CaretRight, LockSimple, X } from '@phosphor-icons/react';
import { ensureBaseChain, type Eip1193Provider } from '@/lib/ensure-base-chain';
import { fetchDiamondBalance } from '@/lib/diamonds-balance';
import { useSound } from '@/hooks/useSound';
import styles from './FieldNotesSheet.module.css';

const UNSEAL_COST = 400;
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const DIAMONDS_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS || '';
const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
const BASE_RPC = 'https://mainnet.base.org';
// A burn is a real user-signed tx, so the wallet needs a little Base ETH for
// gas. Below this we warn up front instead of letting the transfer fail.
const GAS_MIN_WEI = utils.parseEther('0.000005');

/**
 * Read the wallet's native ETH balance on Base and report whether it is too
 * low to likely cover gas. Returns null when the read is uncertain — callers
 * treat null as "don't block", so a flaky RPC never traps the user.
 */
async function readGasLow(address: string): Promise<boolean | null> {
  try {
    const rpc = new providers.JsonRpcProvider(BASE_RPC);
    const wei = await rpc.getBalance(address);
    return wei.lt(GAS_MIN_WEI);
  } catch {
    return null;
  }
}

type UnsealPhase = 'idle' | 'burning' | 'verifying';

interface UnsealedNote {
  date: string;
  content: string;
  day: number;
  weekNumber: number;
  submittedAt: number | null;
}

interface FieldNotesSheetProps {
  onClose: () => void;
}

function formatDate(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

/* Deterministic cipher gibberish for the sealed page */
function cipherLine(seed: number, length: number): string {
  const glyphs = '¤◊∆›‡§∴φΞλΨ0x7f3a9e#%&';
  let out = '';
  for (let i = 0; i < length; i++) {
    out += glyphs[(seed * 31 + i * 17) % glyphs.length];
    if (i % 6 === 5) out += ' ';
  }
  return out;
}

export default function FieldNotesSheet({ onClose }: FieldNotesSheetProps) {
  const { authenticated } = usePrivy();
  const { address, isConnected, connector } = useAccount();
  const { play } = useSound();
  const [notes, setNotes] = useState<UnsealedNote[] | null>(null);
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<UnsealPhase>('idle');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [diamondBalance, setDiamondBalance] = useState<number | null>(null);
  const [gasLow, setGasLow] = useState<boolean | null>(null);

  const cipherLines = useMemo(
    () => Array.from({ length: 14 }, (_, i) => cipherLine(i + 3, 34 + ((i * 7) % 12))),
    []
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (!notes) return;
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, notes.length - 1));
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notes, onClose]);

  // Pre-flight when the confirm dialog opens: surface the live diamond balance
  // and flag a near-empty ETH balance before the user tries to sign. Reads are
  // best-effort — a null result never blocks the attempt.
  useEffect(() => {
    if (!confirmOpen || !address) {
      setDiamondBalance(null);
      setGasLow(null);
      setBalanceLoading(false);
      return;
    }
    let cancelled = false;
    setBalanceLoading(true);
    setDiamondBalance(null);
    setGasLow(null);
    (async () => {
      const [diamonds, lowGas] = await Promise.all([
        fetchDiamondBalance(address),
        readGasLow(address),
      ]);
      if (cancelled) return;
      setDiamondBalance(diamonds);
      setGasLow(lowGas);
      setBalanceLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [confirmOpen, address]);

  const notEnoughDiamonds = diamondBalance !== null && diamondBalance < UNSEAL_COST;

  const unseal = async () => {
    if (phase !== 'idle') return;
    setError(null);

    if (!authenticated) {
      setError('Sign in to unseal your field notes.');
      return;
    }
    if (!isConnected || !connector) {
      setError('Connect a wallet to burn diamonds.');
      return;
    }
    if (!DIAMONDS_TOKEN_ADDRESS) {
      setError('Diamonds token is not configured.');
      return;
    }
    if (notEnoughDiamonds) {
      setError(`You need ${UNSEAL_COST} diamonds to unseal — you have ${diamondBalance}.`);
      return;
    }

    setPhase('burning');
    try {
      // Burn: a real ERC-20 transfer of $BLUE to the dead address on Base,
      // signed by the user's wallet. The server verifies before unsealing.
      const eip1193 = (await connector.getProvider()) as Eip1193Provider;
      await ensureBaseChain(eip1193);
      const web3Provider = new providers.Web3Provider(eip1193 as providers.ExternalProvider);
      const signer = web3Provider.getSigner();
      const token = new Contract(DIAMONDS_TOKEN_ADDRESS, ERC20_TRANSFER_ABI, signer);
      const tx = await token.transfer(BURN_ADDRESS, utils.parseUnits(String(UNSEAL_COST), 18));
      await tx.wait(1);

      setPhase('verifying');
      const res = await fetch('/api/daily-notes/unseal', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: tx.hash }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.error === 'no_notes') {
          setError('No field notes yet. Write a daily note first.');
        } else if (data?.error === 'burn_not_verified') {
          setError('The burn could not be verified on Base. Try again in a moment.');
        } else if (data?.error === 'tx_already_used') {
          setError('That burn was already redeemed.');
        } else {
          setError('Could not unseal your notes. Try again.');
        }
        return;
      }
      setNotes(data.notes ?? []);
      setPage(0);
      setConfirmOpen(false);
    } catch (err: any) {
      console.error('[field-notes] burn failed:', err);
      if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') {
        setError('Burn cancelled in wallet.');
      } else if (err?.code === 'CALL_EXCEPTION' || err?.code === 'UNPREDICTABLE_GAS_LIMIT') {
        setError(`Not enough diamonds — unsealing burns ${UNSEAL_COST}.`);
      } else if (err?.code === 'INSUFFICIENT_FUNDS') {
        setError('Not enough ETH on Base to pay gas for the burn.');
      } else {
        const detail = String(err?.reason || err?.shortMessage || err?.message || 'unknown error').slice(0, 140);
        setError(`Burn failed: ${detail}`);
      }
    } finally {
      setPhase('idle');
    }
  };

  const note = notes?.[page] ?? null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheetStage} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => { play('click'); onClose(); }}
          onMouseEnter={() => play('soft-hover')}
          aria-label={notes ? 'Re-seal and close' : 'Close'}
        >
          <X size={18} weight="bold" />
        </button>

        {/* Paper stack */}
        <div className={styles.stackSheet} aria-hidden="true" />
        <div className={`${styles.stackSheet} ${styles.stackSheetTwo}`} aria-hidden="true" />

        <div className={styles.sheet}>
          {!notes ? (
            <div className={styles.sealedFace}>
              <div className={styles.cipherBlock} aria-hidden="true">
                {cipherLines.map((line, i) => (
                  <span key={i} className={styles.cipherLine}>{line}</span>
                ))}
              </div>
              <div className={styles.sealCenter}>
                <span className={styles.sealStamp}>
                  <LockSimple size={26} weight="fill" />
                </span>
                <span className={styles.sealedTitle}>Field Notes — Sealed</span>
                <span className={styles.sealedSub}>
                  Your daily notes are encrypted at rest. Burning {UNSEAL_COST} diamonds unseals them for this sitting; they re-seal when you close the sheet.
                </span>
                <button
                  type="button"
                  className={styles.unsealOuter}
                  onClick={() => { play('click'); setError(null); setConfirmOpen(true); }}
                  onMouseEnter={() => play('hover')}
                  disabled={phase !== 'idle'}
                >
                  <span className={styles.unsealInner}>
                    <img src="/icons/ui-diamond.svg" alt="" className={styles.unsealDiamond} />
                    Unseal notes
                  </span>
                </button>
              </div>
            </div>
          ) : note ? (
            <div className={styles.noteFace}>
              <div className={styles.noteHeader}>
                <span className={styles.noteDate}>{formatDate(note.date)}</span>
                <span className={styles.noteMeta}>Week {note.weekNumber} · Day {note.day}</span>
              </div>
              <div className={styles.noteBody}>{note.content}</div>
              <div className={styles.pager}>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => { play('click'); setPage((p) => Math.max(p - 1, 0)); }}
                  onMouseEnter={() => play('soft-hover')}
                  disabled={page === 0}
                  aria-label="Previous note"
                >
                  <CaretLeft size={16} weight="bold" />
                </button>
                <span className={styles.pageCount}>{page + 1} of {notes.length}</span>
                <button
                  type="button"
                  className={styles.pagerBtn}
                  onClick={() => { play('click'); setPage((p) => Math.min(p + 1, notes.length - 1)); }}
                  onMouseEnter={() => play('soft-hover')}
                  disabled={page === notes.length - 1}
                  aria-label="Next note"
                >
                  <CaretRight size={16} weight="bold" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {confirmOpen && (
          <div
            className={styles.confirmOverlay}
            onClick={() => phase === 'idle' && setConfirmOpen(false)}
          >
            <div
              className={styles.confirmDialog}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.confirmTitleBar}>
                <span className={styles.confirmTitleText}>unseal.notes</span>
              </div>
              <div className={styles.confirmBody}>
                <div className={styles.confirmIcon}>
                  <img src="/icons/ui-diamond.svg" alt="" width={26} height={26} />
                </div>
                <p className={styles.confirmMessage}>
                  Burn {UNSEAL_COST} diamonds to unseal your notes? They re-seal when you close the sheet.
                </p>
                {balanceLoading ? (
                  <p className={styles.confirmBalance}>Checking your balance…</p>
                ) : diamondBalance !== null ? (
                  <p className={`${styles.confirmBalance} ${notEnoughDiamonds ? styles.confirmBalanceLow : ''}`}>
                    {notEnoughDiamonds
                      ? `You have ${diamondBalance} diamonds — unsealing needs ${UNSEAL_COST}.`
                      : `You have ${diamondBalance} diamonds.`}
                  </p>
                ) : null}
                {gasLow === true && (
                  <p className={styles.confirmHint}>
                    You will also need a little ETH on Base to cover gas — about a few cents. The burn cannot be signed without it.
                  </p>
                )}
                {error && <p className={styles.confirmError} role="alert">{error}</p>}
                <div className={styles.confirmButtons}>
                  <button
                    type="button"
                    className={styles.confirmBtnCancel}
                    onClick={() => { play('click'); setConfirmOpen(false); }}
                    onMouseEnter={() => play('hover')}
                    disabled={phase !== 'idle'}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.confirmBtnBurn}
                    onClick={() => { play('click'); unseal(); }}
                    onMouseEnter={() => play('hover')}
                    disabled={phase !== 'idle' || notEnoughDiamonds}
                  >
                    {phase === 'burning' ? 'Burning…' : phase === 'verifying' ? 'Verifying…' : 'Burn'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
