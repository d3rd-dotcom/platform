'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import { useScrollLock } from '@/hooks/useScrollLock';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import dinoConfig from '@/lib/dinopersonality.json';
import styles from './DinoDialogue.module.css';

// ── Dino Voice TTS ──────────────────────────────────────────
const VOICE_PREF_KEY = 'dinoDialogue.voiceEnabled';
const DINO_VOICE_ID =
  (dinoConfig as { tts?: { elevenlabs?: { voiceId?: string } } })
    .tts?.elevenlabs?.voiceId || '';

function sanitizeForSpeech(text: string): string {
  return text.replace(/\[([A-Za-z0-9])\]/g, '$1').trim();
}

async function fetchDinoAudio(
  text: string,
  signal: AbortSignal,
): Promise<HTMLAudioElement> {
  const res = await fetch('/api/voice/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voiceId: DINO_VOICE_ID }),
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

export type DinoEmotion =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'sleepy'
  | 'cool'
  | 'excited'
  | 'anxious';

export interface DinoChatback {
  placeholder?: string;
  onSubmit?: (reply: string, lineIndex: number) => void;
}

export interface DinoDialogueProps {
  open: boolean;
  lines: string[];
  emotion?: DinoEmotion;
  onClose: () => void;
  speed?: number;
  reward?: number;
  title?: string;
  subtitle?: string;
  placement?: 'bottom' | 'center';
  chatback?: DinoChatback;
}

const EXPRESSION_IMAGE: Record<DinoEmotion, string> = {
  happy: '/images/dino-expressions/dino-happy.png',
  sad: '/images/dino-expressions/dino-sad.png',
  angry: '/images/dino-expressions/dino-angry.png',
  surprised: '/images/dino-expressions/dino-surprised.png',
  sleepy: '/images/dino-expressions/dino-sleepy.png',
  cool: '/images/dino-expressions/dino-cool.png',
  excited: '/images/dino-expressions/dino-excited.png',
  anxious: '/images/dino-expressions/dino-anxious.png',
};

interface HistoryEntry {
  speaker: 'Dino' | 'You';
  text: string;
}
const dialogueHistory: HistoryEntry[] = [];

function pushHistory(text: string, speaker: HistoryEntry['speaker'] = 'Dino') {
  const trimmed = text.trim();
  if (!trimmed) return;
  const last = dialogueHistory[dialogueHistory.length - 1];
  if (last && last.text === trimmed && last.speaker === speaker) return;
  dialogueHistory.push({ speaker, text: trimmed });
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const DinoDialogue: React.FC<DinoDialogueProps> = ({
  open,
  lines,
  emotion = 'happy',
  onClose,
  speed = 22,
  reward,
  title,
  subtitle,
  placement: _placement = 'center',
  chatback,
}) => {
  const { play } = useSound();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const arrowRef = useRef<HTMLButtonElement | null>(null);
  const chatbackInputRef = useRef<HTMLInputElement | null>(null);
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
  const [reply, setReply] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const voiceEnabledRef = useRef(false);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  useScrollLock(open);

  const preloadImgRef = useCallback((img: HTMLImageElement | null) => {
    if (img && img.complete && img.naturalWidth > 0) setPortraitReady(true);
  }, []);

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

  const stopVoice = useCallback(() => {
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  }, []);

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

  useEffect(() => {
    if (!open || !portraitReady || !voiceEnabled) return;
    const line = sanitizeForSpeech(activeLine);
    if (!line) return;

    stopVoice();
    const controller = new AbortController();
    voiceAbortRef.current = controller;
    fetchDinoAudio(line, controller.signal)
      .then((el) => {
        if (controller.signal.aborted) return;
        currentAudioRef.current = el;
        el.play().catch(() => {});
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        console.warn('[DinoDialogue] TTS failed:', err);
      });

    return () => controller.abort();
  }, [open, portraitReady, voiceEnabled, activeLine, safeIndex, stopVoice]);

  useEffect(() => {
    if (!open) stopVoice();
  }, [open, stopVoice]);

  useEffect(() => {
    if (!open) return;
    setLineIndex(0);
    setHistoryOpen(false);
    setReply('');
  }, [open, safeLines]);

  const clearTyping = useCallback(() => {
    if (typeTimer.current) {
      clearTimeout(typeTimer.current);
      typeTimer.current = null;
    }
  }, []);

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

  const sendReply = useCallback(() => {
    const trimmed = reply.trim();
    if (!trimmed) return;
    play('click');
    if (isTyping) finishTyping();
    pushHistory(trimmed, 'You');
    chatback?.onSubmit?.(trimmed, safeIndex);
    setReply('');
    if (safeIndex < safeLines.length - 1) {
      setLineIndex((n) => n + 1);
    } else {
      close();
    }
  }, [reply, play, isTyping, finishTyping, chatback, safeIndex, safeLines.length, close]);

  const handleChatbackSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendReply();
    },
    [sendReply],
  );

  const handleChatbackKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      sendReply();
    },
    [sendReply],
  );

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
    play('click');
    onClose();
  }, [play, onClose]);

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

  useEffect(() => {
    if (!open || !portraitReady) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      (chatbackInputRef.current ?? arrowRef.current)?.focus();
    }, 30);
    return () => {
      clearTimeout(t);
      previouslyFocused.current?.focus?.();
    };
  }, [open, portraitReady]);

  const expressionSrc = EXPRESSION_IMAGE[emotion];

  if (!open || !portraitReady) {
    return (
      <Image
        ref={preloadImgRef}
        src={expressionSrc}
        alt=""
        width={512}
        height={576}
        priority
        className={styles.preloadImage}
        onLoad={() => setPortraitReady(true)}
      />
    );
  }

  const hover = () => play('soft-hover');

  const menuItems: { label: string; onClick: () => void }[] = [
    { label: 'History', onClick: handleHistory },
    { label: 'Skip', onClick: handleSkip },
    { label: 'Load', onClick: handleStubClose },
  ];

  return (
    <div
      ref={overlayRef}
      className={`${styles.overlay} ${styles.overlayCenter}`}
      role="dialog"
      aria-label="Dino dialogue"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        className={`${styles.stage} ${portraitReady ? styles.stageReady : ''}`}
      >
        <div className={styles.portrait}>
          <Image
            src={expressionSrc}
            alt={`Dino, ${emotion}`}
            width={512}
            height={576}
            priority
            className={styles.portraitImage}
            onLoad={() => setPortraitReady(true)}
          />
          <div className={styles.nameCard}>
            <span className={styles.nameText}>Dino</span>
          </div>
        </div>

        <div className={styles.box}>
          <button
            type="button"
            className={`${styles.voiceButton} ${voiceEnabled ? styles.voiceButtonActive : ''}`}
            onClick={toggleVoice}
            onMouseEnter={hover}
            aria-pressed={voiceEnabled}
            aria-label={voiceEnabled ? 'Turn off Dino voice' : 'Turn on Dino voice'}
            title={
              voiceEnabled
                ? 'Voice on — Dino reads each line aloud'
                : 'Voice off — tap to let Dino read lines aloud'
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
          {(title || subtitle) && (
            <div className={styles.header}>
              {title && <h2 className={styles.title}>{title}</h2>}
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          )}
          <div
            className={`${styles.message} ${title || subtitle ? styles.messageBelowHeader : ''}`}
          >
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

          {chatback && (
            <form className={styles.chatback} onSubmit={handleChatbackSubmit}>
              <input
                ref={chatbackInputRef}
                type="text"
                className={styles.chatbackInput}
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={handleChatbackKeyDown}
                placeholder={chatback.placeholder ?? 'Answer Dino'}
                aria-label="Reply to Dino"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="submit"
                className={styles.chatbackSend}
                onMouseEnter={hover}
                aria-label="Send reply"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </form>
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

export default DinoDialogue;