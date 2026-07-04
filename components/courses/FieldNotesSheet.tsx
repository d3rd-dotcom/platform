'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { Contract, providers, utils } from 'ethers';
import { CaretLeft, CaretRight, LockSimple, X } from '@phosphor-icons/react';
import { ensureBaseChain, type Eip1193Provider } from '@/lib/ensure-base-chain';
import { useSound } from '@/hooks/useSound';
import styles from './FieldNotesSheet.module.css';

const UNSEAL_COST = 400;
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';
const DIAMONDS_TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS || '';
const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];

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
  const { isConnected, connector } = useAccount();
  const { play } = useSound();
  const [notes, setNotes] = useState<UnsealedNote[] | null>(null);
  const [page, setPage] = useState(0);
  const [phase, setPhase] = useState<UnsealPhase>('idle');
  const [error, setError] = useState<string | null>(null);

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

  const unseal = async () => {
    if (phase !== 'idle') return;
    play('click');
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
    } catch (err: any) {
      if (err?.code === 4001 || err?.code === 'ACTION_REJECTED') {
        setError('Burn cancelled in wallet.');
      } else if (err?.code === 'CALL_EXCEPTION' || err?.code === 'UNPREDICTABLE_GAS_LIMIT') {
        setError(`Not enough diamonds — unsealing burns ${UNSEAL_COST} $BLUE.`);
      } else {
        setError(err?.message?.includes('Base') ? err.message : 'Could not complete the burn. Try again.');
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
                  onClick={unseal}
                  onMouseEnter={() => play('hover')}
                  disabled={phase !== 'idle'}
                >
                  <span className={styles.unsealInner}>
                    <img src="/icons/ui-diamond.svg" alt="" className={styles.unsealDiamond} />
                    {phase === 'burning'
                      ? 'Burning…'
                      : phase === 'verifying'
                        ? 'Verifying…'
                        : `Burn ${UNSEAL_COST} to unseal`}
                  </span>
                </button>
                {error && <span className={styles.error}>{error}</span>}
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
      </div>
    </div>
  );
}
