'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import { useScrollLock } from '@/hooks/useScrollLock';
import styles from './BlueDialogue.module.css';

export type BlueEmotion = 'happy' | 'confused' | 'sad' | 'pain';

export interface BlueDialogueProps {
  /** Controls whether the full-screen overlay is mounted + visible. */
  open: boolean;
  /** Ordered dialogue lines. The arrow advances through them; the last closes. */
  lines: string[];
  /** Emotion tint applied to the torso art (subtle hue shift). */
  emotion?: BlueEmotion;
  /** Fired on close (arrow-past-last, ESC, backdrop, or a stub button). */
  onClose: () => void;
  /** Milliseconds per typewritten character. */
  speed?: number;
  /** Diamond amount to present as a reward chip above the dialogue text. */
  reward?: number;
}

/**
 * Session-scoped history of every line Blue has spoken. Module-level so it
 * survives remounts within a single browser session (spec requirement).
 */
interface HistoryEntry {
  speaker: 'Blue';
  text: string;
}
const dialogueHistory: HistoryEntry[] = [];

function pushHistory(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const last = dialogueHistory[dialogueHistory.length - 1];
  if (last && last.text === trimmed) return; // de-dupe consecutive repeats
  dialogueHistory.push({ speaker: 'Blue', text: trimmed });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

const BlueDialogue: React.FC<BlueDialogueProps> = ({
  open,
  lines,
  emotion = 'happy',
  onClose,
  speed = 22,
  reward,
}) => {
  const { play } = useSound();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLButtonElement | null>(null);
  const typeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const safeLines = useMemo(
    () => (lines.length > 0 ? lines : ['']),
    [lines],
  );

  const [lineIndex, setLineIndex] = useState(0);
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [displayReward, setDisplayReward] = useState(0);

  // Count the reward chip up from zero when the overlay opens.
  useEffect(() => {
    if (!open || !reward) return;
    if (prefersReducedMotion()) {
      setDisplayReward(reward);
      return;
    }
    setDisplayReward(0);
    const duration = 900;
    const start = performance.now();
    let frame: number;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayReward(Math.round(reward * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [open, reward]);

  const safeIndex = lineIndex >= safeLines.length ? safeLines.length - 1 : lineIndex;
  const activeLine = safeLines[safeIndex] ?? '';

  useScrollLock(open);

  // Reset to the first line whenever the overlay opens or the script changes.
  useEffect(() => {
    if (!open) return;
    setLineIndex(0);
    setHistoryOpen(false);
  }, [open, safeLines]);

  const clearTyping = useCallback(() => {
    if (typeTimer.current) {
      clearTimeout(typeTimer.current);
      typeTimer.current = null;
    }
  }, []);

  // Typewriter reveal for the active line (instant under reduced-motion).
  useEffect(() => {
    if (!open) return;
    clearTyping();

    if (prefersReducedMotion() || speed <= 0) {
      setDisplayed(activeLine);
      setIsTyping(false);
      pushHistory(activeLine);
      return;
    }

    setDisplayed('');
    setIsTyping(true);
    let i = 0;
    const step = () => {
      if (i < activeLine.length) {
        setDisplayed(activeLine.slice(0, i + 1));
        i += 1;
        typeTimer.current = setTimeout(step, speed);
      } else {
        setIsTyping(false);
        pushHistory(activeLine);
      }
    };
    typeTimer.current = setTimeout(step, 90);

    return clearTyping;
  }, [open, activeLine, speed, clearTyping]);

  const finishTyping = useCallback(() => {
    clearTyping();
    setDisplayed(activeLine);
    setIsTyping(false);
    pushHistory(activeLine);
  }, [activeLine, clearTyping]);

  const close = useCallback(() => {
    play('navigation');
    onClose();
  }, [onClose, play]);

  // Right arrow: advance if more lines remain, otherwise close.
  const handleAdvance = useCallback(() => {
    play('click');
    if (isTyping) {
      finishTyping();
      return;
    }
    if (safeIndex < safeLines.length - 1) {
      setLineIndex((n) => n + 1);
    } else {
      close();
    }
  }, [play, isTyping, finishTyping, safeIndex, safeLines.length, close]);

  // SKIP: jump the typewriter to full; if already full, close.
  const handleSkip = useCallback(() => {
    play('click');
    if (isTyping) {
      finishTyping();
    } else {
      close();
    }
  }, [play, isTyping, finishTyping, close]);

  const handleHistory = useCallback(() => {
    play('click');
    setHistoryOpen((v) => !v);
  }, [play]);

  const handleStubClose = useCallback(() => {
    // SAVE / LOAD / SETTINGS are stubs for now.
    play('click');
    onClose();
  }, [play, onClose]);

  // ESC closes; focus trap keeps Tab inside the dialog.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key === 'Tab' && overlayRef.current) {
        const nodes = Array.from(
          overlayRef.current.querySelectorAll<HTMLElement>(FOCUSABLE),
        ).filter((el) => !el.hasAttribute('disabled'));
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Focus management: capture, focus the arrow on open, restore on close.
  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => arrowRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const hover = () => play('soft-hover');

  const menuItems: { label: string; onClick: () => void }[] = [
    { label: 'History', onClick: handleHistory },
    { label: 'Skip', onClick: handleSkip },
    { label: 'Save', onClick: handleStubClose }, // TODO: real save-state
    { label: 'Load', onClick: handleStubClose }, // TODO: real load-state
    { label: 'Settings', onClick: handleStubClose }, // TODO: real settings panel
  ];

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Blue dialogue"
      onMouseDown={(e) => {
        // Backdrop click (not a click bubbling up from the panel) closes.
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.stage}>
        <div className={`${styles.torso} ${styles[`emotion_${emotion}`] ?? ''}`}>
          <Image
            src="/images/blue-dialogue-torso.png?v=2"
            alt="Blue"
            width={1254}
            height={1254}
            priority
            className={styles.torsoImage}
          />
        </div>

        <button
          type="button"
          className={styles.bigNext}
          onClick={handleAdvance}
          onMouseEnter={hover}
          aria-label={
            safeIndex < safeLines.length - 1 ? 'Next line' : 'Close dialogue'
          }
        >
          <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true">
            <path
              d="M9 5l7 7-7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className={styles.bottom}>
          <div className={styles.nameCard}>
            <span className={styles.nameText}>Blue</span>
          </div>

          <div className={styles.box}>
            {typeof reward === 'number' && reward > 0 && (
              <div className={styles.rewardChip} role="status">
                <Image
                  src="/icons/ui-diamond.svg"
                  alt=""
                  width={22}
                  height={22}
                  className={styles.rewardIcon}
                />
                <span className={styles.rewardAmount}>+{displayReward}</span>
                <span className={styles.rewardLabel}>diamonds</span>
              </div>
            )}
            <p className={styles.text} aria-live="polite">
              <span className={styles.quote} aria-hidden="true">
                &ldquo;
              </span>
              {displayed}
              {isTyping && <span className={styles.cursor} aria-hidden="true" />}
              {!isTyping && (
                <span className={styles.quote} aria-hidden="true">
                  &rdquo;
                </span>
              )}
            </p>

            {historyOpen && (
              <div className={styles.historyPanel}>
                <div className={styles.historyHead}>History</div>
                <ul className={styles.historyList}>
                  {dialogueHistory.length === 0 && (
                    <li className={styles.historyEmpty}>No lines yet this session.</li>
                  )}
                  {dialogueHistory.map((entry, idx) => (
                    <li key={idx} className={styles.historyItem}>
                      <span className={styles.historySpeaker}>{entry.speaker}</span>
                      <span className={styles.historyLine}>{entry.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className={styles.menuRow}>
              <div className={styles.menuItems}>
                {menuItems.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className={styles.menuButton}
                    onClick={item.onClick}
                    onMouseEnter={hover}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <button
                ref={arrowRef}
                type="button"
                className={styles.arrow}
                onClick={handleAdvance}
                onMouseEnter={hover}
                aria-label={
                  safeIndex < safeLines.length - 1 ? 'Next line' : 'Close dialogue'
                }
              >
                <svg viewBox="0 0 24 24" width="32" height="32" aria-hidden="true">
                  <path
                    d="M9 5l7 7-7 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlueDialogue;
