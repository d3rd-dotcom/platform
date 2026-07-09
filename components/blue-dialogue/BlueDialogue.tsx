'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './BlueDialogue.module.css';

// ── Blue Voice TTS ──────────────────────────────────────────
// Opt-in, off by default. Mirrors the pattern in BlueChat: a persisted
// preference gates an ElevenLabs-backed read-aloud of each spoken line.
const VOICE_PREF_KEY = 'blueDialogue.voiceEnabled';

/** Strip single-letter hotkey brackets (e.g. "[E]nd" → "End") before speaking. */
function sanitizeForSpeech(text: string): string {
  return text.replace(/\[([A-Za-z0-9])\]/g, '$1').trim();
}

/** Fetch ElevenLabs audio for a line and return a ready-to-play element. */
async function fetchBlueAudio(
  text: string,
  signal: AbortSignal,
): Promise<HTMLAudioElement> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
    signal,
  });
  if (!res.ok) throw new Error('TTS request failed');
  const { audio } = await res.json();
  if (!audio) throw new Error('No audio data');

  const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'audio/mpeg' });
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  el.volume = 0.5;
  el.addEventListener('ended', () => URL.revokeObjectURL(url));
  return el;
}

export type BlueEmotion =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'confused'
  | 'pain'
  | 'calm';

export interface BlueDialogueProps {
  /** Controls whether the full-screen overlay is mounted + visible. */
  open: boolean;
  /** Ordered dialogue lines. The arrow advances through them; the last closes. */
  lines: string[];
  /** Selects one of Blue's eight distinct expression portraits. */
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

const EXPRESSION_POSITION: Record<
  BlueEmotion,
  { left: string; top: string }
> = {
  neutral: { left: '-25.5%', top: '0%' },
  happy: { left: '-176.5%', top: '0%' },
  sad: { left: '-327.5%', top: '0%' },
  angry: { left: '-478.5%', top: '0%' },
  surprised: { left: '-25.5%', top: '-100%' },
  confused: { left: '-176.5%', top: '-100%' },
  pain: { left: '-327.5%', top: '-100%' },
  calm: { left: '-478.5%', top: '-100%' },
};

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
  const historyCloseRef = useRef<HTMLButtonElement | null>(null);
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
  const [portraitReady, setPortraitReady] = useState(false);
  const [displayReward, setDisplayReward] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceEnabledRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Count the reward chip up from zero when the overlay opens.
  useEffect(() => {
    if (!open || !portraitReady || !reward) return;
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
  }, [open, portraitReady, reward]);

  const safeIndex = lineIndex >= safeLines.length ? safeLines.length - 1 : lineIndex;
  const activeLine = safeLines[safeIndex] ?? '';

  // Stop any in-flight fetch and pause any playing audio.
  const stopVoice = useCallback(() => {
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

  // Load the persisted voice preference (default off) once on mount.
  useEffect(() => {
    if (getStorageItem(VOICE_PREF_KEY) === '1') {
      setVoiceEnabled(true);
      voiceEnabledRef.current = true;
    }
  }, []);

  const toggleVoice = useCallback(() => {
    play('click');
    setVoiceEnabled((prev) => {
      const next = !prev;
      voiceEnabledRef.current = next;
      setStorageItem(VOICE_PREF_KEY, next ? '1' : '0');
      if (!next) stopVoice();
      return next;
    });
  }, [play, stopVoice]);

  // Read the active line aloud when voice is on. Fires as the line becomes
  // active (in parallel with the typewriter) and cancels the previous line's
  // audio if the user advances early. Failures are swallowed so the dialogue
  // keeps working without audio.
  useEffect(() => {
    if (!open || !portraitReady || !voiceEnabled) return;
    const line = sanitizeForSpeech(activeLine);
    if (!line) return;

    stopVoice();
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    fetchBlueAudio(line, controller.signal)
      .then((el) => {
        if (controller.signal.aborted) return;
        currentAudioRef.current = el;
        el.play().catch(() => {});
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[BlueDialogue] TTS failed:', err);
      });

    return () => controller.abort();
  }, [open, portraitReady, voiceEnabled, activeLine, safeIndex, stopVoice]);

  // Cut audio when the dialogue closes.
  useEffect(() => {
    if (!open) stopVoice();
  }, [open, stopVoice]);

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
    if (!open || !portraitReady) return;
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
  }, [open, portraitReady, activeLine, speed, clearTyping]);

  const finishTyping = useCallback(() => {
    clearTyping();
    setDisplayed(activeLine);
    setIsTyping(false);
    pushHistory(activeLine);
  }, [activeLine, clearTyping]);

  const close = useCallback(() => {
    play('navigation');
    stopVoice();
    onClose();
  }, [onClose, play, stopVoice]);

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

  const closeHistory = useCallback(() => {
    play('click');
    setHistoryOpen(false);
    window.setTimeout(() => arrowRef.current?.focus(), 0);
  }, [play]);

  useEffect(() => {
    if (!historyOpen) return;
    historyCloseRef.current?.focus();
  }, [historyOpen]);

  const handleStubClose = useCallback(() => {
    // Load is a stub for now.
    play('click');
    onClose();
  }, [play, onClose]);

  // ESC closes. The dialogue is no longer a modal (the page behind stays
  // interactive), so Tab is left free to move focus in and out of the panel.
  useEffect(() => {
    if (!open || !portraitReady) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (historyOpen) {
          closeHistory();
          return;
        }
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, portraitReady, close, historyOpen, closeHistory]);

  // Focus management: capture, focus the arrow on open, restore on close.
  useEffect(() => {
    if (!open || !portraitReady) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => arrowRef.current?.focus(), 30);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, portraitReady]);

  if (!open || !portraitReady) {
    return (
      <Image
        src="/images/blue-dialogue-expressions.png"
        alt=""
        width={2752}
        height={1536}
        sizes="(max-width: 560px) 1400px, 1800px"
        priority
        className={styles.preloadImage}
        onLoad={() => setPortraitReady(true)}
      />
    );
  }

  const hover = () => play('soft-hover');
  const expressionPosition = EXPRESSION_POSITION[emotion];

  const menuItems: { label: string; onClick: () => void }[] = [
    { label: 'History', onClick: handleHistory },
    { label: 'Skip', onClick: handleSkip },
    { label: 'Load', onClick: handleStubClose }, // TODO: real load-state
  ];

  return (
    <div
      ref={overlayRef}
      className={styles.overlay}
      role="dialog"
      aria-label="Blue dialogue"
    >
      <div
        className={`${styles.stage} ${portraitReady ? styles.stageReady : ''}`}
      >
        <div className={styles.portrait}>
          <Image
            src="/images/blue-dialogue-expressions.png"
            alt={`Blue, ${emotion}`}
            width={2752}
            height={1536}
            sizes="(max-width: 560px) 1400px, 1800px"
            priority
            className={styles.portraitImage}
            style={
              {
                '--portrait-left': expressionPosition.left,
                '--portrait-top': expressionPosition.top,
              } as React.CSSProperties
            }
            onLoad={() => setPortraitReady(true)}
          />
          <div className={styles.nameCard}>
            <span className={styles.nameText}>Blue</span>
          </div>
        </div>

        <div className={styles.box}>
          <div className={styles.message}>
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
          </div>

          {historyOpen && (
            <div className={styles.historyPanel}>
              <div className={styles.historyHeadRow}>
                <div className={styles.historyHead}>History</div>
                <button
                  ref={historyCloseRef}
                  type="button"
                  className={styles.historyClose}
                  onClick={closeHistory}
                  onMouseEnter={hover}
                >
                  Close
                </button>
              </div>
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

          <div className={styles.controls}>
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
              <button
                type="button"
                className={`${styles.voiceButton} ${voiceEnabled ? styles.voiceButtonActive : ''}`}
                onClick={toggleVoice}
                onMouseEnter={hover}
                aria-pressed={voiceEnabled}
                aria-label={voiceEnabled ? 'Turn off Blue voice' : 'Turn on Blue voice'}
                title={
                  voiceEnabled
                    ? 'Voice on — Blue reads each line aloud'
                    : 'Voice off — tap to let Blue read lines aloud'
                }
              >
                {voiceEnabled ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M11 5L6 9H2v6h4l5 4z" fill="currentColor" stroke="none" />
                    <line x1="22" y1="9" x2="16" y2="15" />
                    <line x1="16" y1="9" x2="22" y2="15" />
                  </svg>
                )}
              </button>
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
              <Image
                src="/icons/ui-arrow.svg"
                alt=""
                width={77}
                height={77}
                className={styles.arrowIcon}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlueDialogue;
