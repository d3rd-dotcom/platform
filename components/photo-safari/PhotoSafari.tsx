'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { analyzeImageDataUrl, locateOnImage, type LocateResult } from '@/lib/safari-analyze';
import AnalysisOverlay from './AnalysisOverlay';
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

interface DetectionResult {
  label: string;
  score: number;
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
  const [detections, setDetections] = useState<DetectionResult[] | null>(null);
  const [locating, setLocating] = useState(false);

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
    setDetections(null);
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

  useEffect(() => {
    if (mode !== 'preview' || !capturedUrl) return;
    setLocating(true);
    setDetections(null);

    analyzeImageDataUrl(capturedUrl).then((analysis) => {
      const localScore = Math.round(
        (analysis.dominantConfidence + (analysis.edgeDensity > 0.3 ? 0.3 : 0)) / 2 * 100,
      );
      setDetections([{ label: analysis.dominantColor, score: localScore }]);
      setLocating(false);
    });

    locateOnImage(capturedUrl, today.text).then((result) => {
      const mapped: DetectionResult[] = result.detections.map((d: LocateResult) => ({
        label: d.label,
        score: Math.round(d.score * 100),
      }));
      if (mapped.length > 0) setDetections(mapped);
      setLocating(false);
    });
  }, [mode, capturedUrl, today.text]);

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
    setDetections(null);
    setMode('success');
    setAnimating(true);
    setTimeout(() => {
      setAnimating(false);
      setMode('idle');
    }, 2200);
  }, [capturedUrl, entries, today, todayKey]);

  const retake = useCallback(() => {
    setCapturedUrl(null);
    setDetections(null);
    openCamera();
  }, [openCamera]);

  const dismiss = useCallback(() => {
    setMode('idle');
    setCapturedUrl(null);
    setDetections(null);
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

  const renderViewfinder = () => {
    switch (mode) {
      case 'camera':
        return (
          <div className={styles.cameraView}>
            {stream && <ScannerScene ref={scannerRef} stream={stream} />}
            <div className={styles.cameraOverlay}>
              <span className={styles.cameraPrompt}>{today.text}</span>
            </div>
            <div className={styles.cameraBottom}>
              {stream && <AnalysisOverlay stream={stream} prompt={today.text} />}
              <button type="button" className={styles.captureBtn} onClick={captureFrame} aria-label="Capture">
                <span className={styles.captureRing} />
              </button>
            </div>
            <button type="button" className={styles.cameraClose} onClick={dismiss} aria-label="Close camera">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        );

      case 'preview':
        return capturedUrl ? (
          <div className={styles.cameraView}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={capturedUrl} alt="Captured" className={styles.previewImage} />
            <div className={styles.cameraOverlay}>
              {detections && detections.length > 0 && (
                <div className={styles.detectionChips}>
                  {detections.map((d, i) => (
                    <span key={i} className={styles.detectionChip}>
                      {d.label} <strong>{d.score}%</strong>
                    </span>
                  ))}
                </div>
              )}
              {locating && <span className={styles.locatingLabel}>Analyzing…</span>}
            </div>
            <div className={styles.cameraBottom}>
              <button type="button" className={styles.previewBtn} onClick={retake}>Retake</button>
              <button type="button" className={styles.previewBtnPrimary} onClick={confirmScan}>Confirm</button>
            </div>
            <button type="button" className={styles.cameraClose} onClick={dismiss} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null;

      case 'success':
        return (
          <div className={`${styles.cameraView} ${styles.successView}`}>
            {capturedUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={capturedUrl} alt="" className={styles.previewImage} />
            )}
            <div className={styles.cameraOverlay}>
              <div className={styles.successBadge}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className={styles.successLabel}>Safari Complete!</span>
              {animating && (
                <div className={styles.successStreak}>
                  +1 day streak
                  {detections && detections.length > 0 && (
                    <span className={styles.successDetect}>
                      {' · '}{detections[0].label} {detections[0].score}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      default:
        return (
          <button type="button" className={styles.idleViewfinder} onClick={openCamera}>
            <div className={styles.idleGradient} />
            <span className={styles.cameraPrompt}>{today.text}</span>
            <div className={styles.idleActions}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Scan Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        );
    }
  };

  return (
    <div className={`${styles.card} ${mode === 'success' || animating ? styles.successCard : ''}`}>
      {renderViewfinder()}

      {error && <p className={styles.error}>{error}</p>}

      {mode === 'idle' && (
        <div className={styles.idleHeader}>
          <span className={styles.label}>Daily Safari</span>
          {todayDone && <span className={styles.check}>Completed</span>}
          {entries.length > 0 && (
            <span className={styles.count}>{entries.length} scan{entries.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      )}

      {entries.length > 0 && mode !== 'success' && !animating && (
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
