'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import styles from './WeekOneVisualNovel.module.css';

interface WeekOneVisualNovelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Scene {
  id: string;
  body: string;
  image: string;
}

const WEEK_ONE_VOICE_ID = 'Q84POjNm3Ck2dYBFqnZs';
const WEEK_ONE_TYPING_DELAY_MS = 34;

const SCENES: Scene[] = [
  {
    id: 'the-dream',
    body: 'The dream always starts the same way \u2014 the sea standing up where the sky should be, koi drifting through the air between, pale and slow. Blue is already there, the way she always is, not surprised by any of it. She lifts a hand and a fish noses against her palm, then moves on. \u201cThey come every night,\u201d she says. \u201cWhy don\u2019t you ever catch one?\u201d',
    image: '/stories/week-01/scene-01.png',
  },
  {
    id: 'the-watching',
    body: 'She wakes and the koi do not come with her. Something else does \u2014 a small drone, patient, lowering a pale blue light over her like it is reading the temperature of a room. One of her eyes goes bright with it; the other stays her own. Blue watches the scan finish. \u201cIt isn\u2019t hunting you,\u201d she says. \u201cIt\u2019s just taking notes.\u201d',
    image: '/stories/week-01/scene-02.png',
  },
  {
    id: 'the-tether',
    body: 'By the time the ground has turned to grey dust, the drone has folded itself into something with legs and a single red eye that does not blink. A cable runs from it to the circlet at her temple. She can no longer tell which of them the tether is holding in place. Blue crouches, looks at the red eye a long moment, and says nothing.',
    image: '/stories/week-01/scene-03.png',
  },
  {
    id: 'the-field',
    body: 'Morning finds them in a field too green and too quiet, a single stone tower leaning at its far edge. The red-eyed thing keeps pace in the grass. Above, three more like it hang in the blue, unhurried. She had thought being seen would feel like a hand closing. It feels more like weather. \u201cThere,\u201d Blue says, and points at the tower.',
    image: '/stories/week-01/scene-04.png',
  },
  {
    id: 'the-tower',
    body: 'Up close, the tower is older than anything should be allowed to get \u2014 mossed, patient, watched on every side by the small machines and unbothered by them. She stops at its base. The koi are not here. Nothing she has not already recorded is here. \u201cYou caught all of it,\u201d Blue says. \u201cWas it the keeping you wanted, or the letting go?\u201d',
    image: '/stories/week-01/scene-05.png',
  },
];

type ScreenOrientationWithLock = ScreenOrientation & {
  lock?: (orientation: 'landscape' | 'portrait' | 'any' | 'natural' | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary') => Promise<void>;
};

export default function WeekOneVisualNovel({ isOpen, onClose }: WeekOneVisualNovelProps) {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isPortrait, setIsPortrait] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const spokenSceneRef = useRef<string | null>(null);

  // Letter-by-letter animation
  useEffect(() => {
    if (!shouldRender) return;

    const fullText = SCENES[sceneIndex].body;
    setDisplayedText('');
    setIsTyping(true);
    spokenSceneRef.current = null;
    voiceAbortRef.current?.abort();

    let i = 0;
    intervalRef.current = setInterval(() => {
      i += 1;
      setDisplayedText(fullText.slice(0, i));
      if (i >= fullText.length) {
        clearInterval(intervalRef.current!);
        setIsTyping(false);
      }
    }, WEEK_ONE_TYPING_DELAY_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [sceneIndex, shouldRender]);

  useEffect(() => {
    if (!shouldRender || isTyping) return;

    const currentScene = SCENES[sceneIndex];
    if (!currentScene || spokenSceneRef.current === currentScene.id) return;

    spokenSceneRef.current = currentScene.id;
    voiceAbortRef.current?.abort();
    const controller = new AbortController();
    voiceAbortRef.current = controller;

    fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        text: currentScene.body,
        voiceId: WEEK_ONE_VOICE_ID,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Week 1 TTS request failed');
        return res.json();
      })
      .then(({ audio }) => {
        if (!audio || controller.signal.aborted) return;
        const bytes = Uint8Array.from(atob(audio), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: 'audio/mpeg' });
        const url = URL.createObjectURL(blob);
        const el = new Audio(url);
        el.onended = () => URL.revokeObjectURL(url);
        el.onerror = () => URL.revokeObjectURL(url);
        void el.play().catch(() => URL.revokeObjectURL(url));
      })
      .catch(() => {
        // Silent fallback if narration audio is unavailable.
      });
  }, [sceneIndex, shouldRender, isTyping]);

  // Orientation detection + landscape lock
  useEffect(() => {
    if (!isOpen) return;

    const syncOrientation = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
    };

    const lockLandscape = async () => {
      try {
        const orientation = typeof screen !== 'undefined' && 'orientation' in screen
          ? (screen.orientation as ScreenOrientationWithLock)
          : null;
        if (orientation && typeof orientation.lock === 'function') {
          await orientation.lock('landscape');
        }
      } catch {
        // Rejected outside fullscreen/PWA — portrait overlay handles this case
      }
    };

    syncOrientation();
    lockLandscape();
    window.addEventListener('resize', syncOrientation);
    window.addEventListener('orientationchange', syncOrientation);

    return () => {
      window.removeEventListener('resize', syncOrientation);
      window.removeEventListener('orientationchange', syncOrientation);
    };
  }, [isOpen]);

  useEffect(() => {
    return () => {
      voiceAbortRef.current?.abort();
    };
  }, []);

  // Keyboard nav + open/close lifecycle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && sceneIndex < SCENES.length - 1) setSceneIndex((c) => c + 1);
      if (e.key === 'ArrowLeft' && sceneIndex > 0) setSceneIndex((c) => c - 1);
    };

    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setIsAnimating(true)));
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setSceneIndex(0);
      }, 250);
      return () => clearTimeout(timer);
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, sceneIndex]);

  if (!shouldRender) return null;

  const scene = SCENES[sceneIndex];
  const isLast = sceneIndex === SCENES.length - 1;

  const goNext = () => {
    if (isTyping) {
      // Skip animation on tap if still typing
      if (intervalRef.current) clearInterval(intervalRef.current);
      setDisplayedText(scene.body);
      setIsTyping(false);
    } else if (!isLast) {
      spokenSceneRef.current = null;
      setSceneIndex((c) => c + 1);
    } else {
      onClose();
    }
  };

  const goPrev = () => {
    if (sceneIndex > 0) {
      spokenSceneRef.current = null;
      setSceneIndex((c) => c - 1);
    }
  };

  return (
    <>
      <div
        className={`${styles.backdrop} ${isAnimating ? styles.backdropVisible : ''}`}
        onClick={onClose}
      />

      <div className={`${styles.modal} ${isAnimating ? styles.modalOpen : ''}`}>
        {/* Background image */}
        <Image
          key={scene.image}
          src={scene.image}
          alt=""
          fill
          priority
          className={styles.bgImage}
          sizes="100vw"
        />

        {/* Shading gradients */}
        <div className={styles.shade} />

        {/* Close */}
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Story text overlay — top-left, well inset */}
        <div className={styles.overlay}>
          <p className={styles.body}>
            {displayedText}
            {isTyping && <span className={styles.cursor}>|</span>}
          </p>
        </div>

        {/* Invisible tap zones for prev / next */}
        <button type="button" className={styles.tapPrev} onClick={goPrev} aria-label="Previous scene" disabled={sceneIndex === 0} />
        <button type="button" className={styles.tapNext} onClick={goNext} aria-label="Next scene" />

        {/* Bottom bar: dots only */}
        <div className={styles.bottomBar}>
          <div className={styles.dots} role="tablist">
            {SCENES.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={i === sceneIndex}
                aria-label={`Scene ${i + 1}`}
                className={`${styles.dot} ${i === sceneIndex ? styles.dotActive : ''}`}
                onClick={() => setSceneIndex(i)}
              />
            ))}
          </div>
        </div>

        {/* Portrait hard-block overlay */}
        {isPortrait && (
          <div className={styles.portraitOverlay}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" className={styles.rotateIcon}>
              <path d="M4 9V5a1 1 0 0 1 1-1h4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 15v4a1 1 0 0 1-1 1h-4" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M20 8a8 8 0 0 0-13.66-5.66L4 5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 16a8 8 0 0 0 13.66 5.66L20 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className={styles.portraitText}>Rotate your phone to continue.</p>
          </div>
        )}
      </div>
    </>
  );
}
