'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import styles from './PhotoSafari.module.css';

const ScannerScene = dynamic(() => import('./ScannerScene'), { ssr: false });

const SAFARIS: string[] = [
  'Scan something blue',
  'Scan a rough texture',
  'Scan something that makes you calm',
  'Scan something round',
  'Scan something green',
  'Scan something soft',
  'Scan something you wrote today',
  'Scan something wooden',
  'Scan something shiny',
  'Scan something old',
  'Scan something that brings you joy',
  'Scan something that represents a goal',
  'Scan something with letters on it',
  'Scan something from nature',
  'Scan something you use every day',
  'Scan something with a pattern',
  'Scan something that is your favorite color',
];

const STORAGE_KEY = 'mwa_photo_safaris';
const MAX_ENTRIES = 30;

interface SafariEntry {
  date: string;
  prompt: string;
  imageData: string;
  promptIndex: number;
}

function getTodaysPrompt(): { text: string; index: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  const index = dayOfYear % SAFARIS.length;
  return { text: SAFARIS[index], index };
}

function loadEntries(): SafariEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEntries(entries: SafariEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* silently fail */
  }
}

export default function PhotoSafari() {
  const today = getTodaysPrompt();
  const [entries, setEntries] = useState<SafariEntry[]>([]);
  const [mode, setMode] = useState<'idle' | 'camera' | 'preview' | 'success'>('idle');
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  const scannerRef = useRef<{ capture: () => string | null }>(null);

  const todayKey = new Date().toISOString().slice(0, 10);
  const todayDone = entries.some((e) => e.date === todayKey);

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  const openCamera = useCallback(async () => {
    setError(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(s);
      setMode('camera');
    } catch {
      setError('Camera access denied or unavailable.');
    }
  }, []);

  const captureFrame = useCallback(() => {
    const dataUrl = scannerRef.current?.capture();
    if (!dataUrl) return;
    setCapturedUrl(dataUrl);

    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
    setMode('preview');
  }, [stream]);

  const confirmScan = useCallback(() => {
    if (!capturedUrl) return;

    const newEntry: SafariEntry = {
      date: todayKey,
      prompt: today.text,
      imageData: capturedUrl,
      promptIndex: today.index,
    };

    const updated = [newEntry, ...entries].slice(0, MAX_ENTRIES);
    setEntries(updated);
    saveEntries(updated);
    setCapturedUrl(null);
    setMode('success');
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setMode('idle');
    }, 1800);
  }, [capturedUrl, entries, today, todayKey]);

  const retake = useCallback(() => {
    setCapturedUrl(null);
    openCamera();
  }, [openCamera]);

  const dismiss = useCallback(() => {
    setMode('idle');
    setCapturedUrl(null);
    setError(null);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
  }, [stream]);

  const formatDate = (iso: string) => {
    const d = new Date(iso + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (mode === 'camera') {
    return (
      <div className={styles.card}>
        <div className={styles.cameraView}>
          {stream && <ScannerScene ref={scannerRef} stream={stream} />}
          <div className={styles.cameraOverlay}>
            <span className={styles.cameraPrompt}>{today.text}</span>
          </div>
          <button type="button" className={styles.captureBtn} onClick={captureFrame} aria-label="Capture">
            <span className={styles.captureRing} />
          </button>
          <button type="button" className={styles.cameraClose} onClick={dismiss} aria-label="Close camera">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'preview' && capturedUrl) {
    return (
      <div className={styles.card}>
        <div className={styles.previewView}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capturedUrl} alt="Captured" className={styles.previewImage} />
          <div className={styles.previewActions}>
            <button type="button" className={styles.previewBtn} onClick={retake}>
              Retake
            </button>
            <button type="button" className={styles.previewBtnPrimary} onClick={confirmScan}>
              Confirm
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'success' || animating) {
    return (
      <div className={`${styles.card} ${styles.successCard}`}>
        <div className={styles.successInner}>
          <div className={styles.successCheck}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span className={styles.successTitle}>Safari Complete!</span>
          <span className={styles.successPrompt}>"{today.text}"</span>
          <span className={styles.successStreak}>+1 day streak</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.label}>Daily Safari</span>
        {todayDone && <span className={styles.check}>Completed</span>}
      </div>

      <p className={styles.prompt}>{today.text}</p>

      <div className={styles.actions}>
        {todayDone ? (
          <span className={styles.count}>{entries.length} scan{entries.length !== 1 ? 's' : ''}</span>
        ) : (
          <>
            <button type="button" className={styles.scanBtn} onClick={openCamera}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Scan Now
            </button>
            <span className={styles.count}>{entries.length} scan{entries.length !== 1 ? 's' : ''}</span>
          </>
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {entries.length > 0 && (
        <div className={styles.gallery}>
          {entries.slice(0, 7).map((entry, i) => (
            <div key={`${entry.date}-${i}`} className={styles.thumbWrap} title={`${entry.prompt} — ${formatDate(entry.date)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={entry.imageData} alt={entry.prompt} className={styles.thumb} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
