'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { useSound } from '@/hooks/useSound';
import styles from './BlueScene.module.css';

interface Balloon {
  id: number;
  /** Horizontal position, percent of scene width. */
  left: number;
  /** Vertical resting position for reduced-motion mode, percent from top. */
  top: number;
  color: string;
  size: number;
  /** Seconds for the full rise. */
  duration: number;
  /** Sway phase offset so balloons don't move in lockstep. */
  delay: number;
  popped: boolean;
}

const BALLOON_COLORS = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-accent)',
  'var(--color-mental-health)',
  'var(--color-productivity)',
];

const MAX_ACTIVE_BALLOONS = 7;
const SPAWN_INTERVAL_MS = 1700;
const FLUSH_DEBOUNCE_MS = 2500;

const MILESTONE_LINES: Array<[number, string]> = [
  [50, 'Fifty pops. Blue is genuinely impressed.'],
  [25, 'Twenty-five — that is dedication.'],
  [10, 'Double digits. The collective thanks you.'],
  [5, 'You are on a roll.'],
  [1, 'Nice pop. It all counts.'],
];

const IDLE_LINE = 'Pop a balloon — every pop joins the community count.';

function balloonLine(pops: number): string {
  for (const [threshold, line] of MILESTONE_LINES) {
    if (pops >= threshold) return line;
  }
  return IDLE_LINE;
}

export default function BlueScene() {
  const { play } = useSound();
  const [balloons, setBalloons] = useState<Balloon[]>([]);
  const [sessionPops, setSessionPops] = useState(0);
  const [communityTotal, setCommunityTotal] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  const idRef = useRef(0);
  const poppedIdsRef = useRef(new Set<number>());
  const sessionPopsRef = useRef(0);
  const pendingPopsRef = useRef(0);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const removalTimersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    fetch('/api/balloon-pops', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.total === 'number') setCommunityTotal(d.total);
      })
      .catch(() => {/* counter is best-effort */});
  }, []);

  const flushPops = useCallback(() => {
    const count = pendingPopsRef.current;
    if (count <= 0) return;
    pendingPopsRef.current = 0;
    fetch('/api/balloon-pops', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (typeof d?.total === 'number') setCommunityTotal(d.total);
      })
      .catch(() => {/* keep optimistic local total */});
  }, []);

  // Flush any unsent pops when the tab is hidden or the component unmounts.
  useEffect(() => {
    const onPageHide = () => {
      const count = pendingPopsRef.current;
      if (count <= 0) return;
      pendingPopsRef.current = 0;
      navigator.sendBeacon?.(
        '/api/balloon-pops',
        new Blob([JSON.stringify({ count })], { type: 'application/json' })
      );
    };
    window.addEventListener('pagehide', onPageHide);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      onPageHide();
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      // eslint-disable-next-line react-hooks/exhaustive-deps
      removalTimersRef.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  // Spawn balloons while the tab is visible.
  useEffect(() => {
    const spawn = () => {
      if (document.hidden) return;
      setBalloons((prev) => {
        if (prev.length >= MAX_ACTIVE_BALLOONS) return prev;
        idRef.current += 1;
        const id = idRef.current;
        const duration = reducedMotion ? 9 : 7 + Math.random() * 5;
        const balloon: Balloon = {
          id,
          left: 4 + Math.random() * 88,
          top: 8 + Math.random() * 55,
          color: BALLOON_COLORS[Math.floor(Math.random() * BALLOON_COLORS.length)],
          size: 44 + Math.random() * 26,
          duration,
          delay: Math.random() * 2,
          popped: false,
        };
        const timer = setTimeout(() => {
          removalTimersRef.current.delete(id);
          setBalloons((p) => p.filter((b) => b.id !== id));
        }, duration * 1000 + 400);
        removalTimersRef.current.set(id, timer);
        return [...prev, balloon];
      });
    };

    spawn();
    const interval = setInterval(spawn, SPAWN_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reducedMotion]);

  const popBalloon = useCallback((id: number) => {
    if (poppedIdsRef.current.has(id)) return;
    poppedIdsRef.current.add(id);

    setBalloons((prev) => prev.map((b) => (b.id === id ? { ...b, popped: true } : b)));

    const existing = removalTimersRef.current.get(id);
    if (existing) clearTimeout(existing);
    const burstTimer = setTimeout(() => {
      removalTimersRef.current.delete(id);
      poppedIdsRef.current.delete(id);
      setBalloons((p) => p.filter((b) => b.id !== id));
    }, 450);
    removalTimersRef.current.set(id, burstTimer);

    sessionPopsRef.current += 1;
    setSessionPops(sessionPopsRef.current);
    play(sessionPopsRef.current % 10 === 0 ? 'celebration' : 'click');
    setCommunityTotal((t) => (t === null ? t : t + 1));

    pendingPopsRef.current += 1;
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(flushPops, FLUSH_DEBOUNCE_MS);
  }, [flushPops, play]);

  const bubbleLine = useMemo(() => balloonLine(sessionPops), [sessionPops]);

  return (
    <section className={styles.scene} aria-label="Balloon popping with Blue">
      <div className={styles.sky} aria-hidden="true" />

      <header className={styles.header}>
        <h2 className={styles.title}>POP THE BALLOON</h2>
      </header>

      <div className={styles.counters}>
        <span className={styles.counterChip}>
          <span className={styles.counterLabel}>you</span>
          <span className={styles.counterValue}>{sessionPops}</span>
        </span>
        <span className={styles.counterChip}>
          <span className={styles.counterLabel}>community</span>
          <span className={styles.counterValue}>
            {communityTotal === null ? '—' : communityTotal.toLocaleString()}
          </span>
        </span>
      </div>

      {balloons.map((b) => (
        <button
          key={b.id}
          type="button"
          className={`${styles.balloon} ${reducedMotion ? styles.balloonStatic : styles.balloonRising} ${b.popped ? styles.balloonPopped : ''}`}
          style={{
            left: `${b.left}%`,
            width: b.size,
            color: b.color,
            ...(reducedMotion ? { top: `${b.top}%` } : {}),
            '--rise-duration': `${b.duration}s`,
            '--sway-delay': `${b.delay}s`,
          } as React.CSSProperties}
          onClick={() => popBalloon(b.id)}
          disabled={b.popped}
          aria-label="Pop balloon"
        >
          {b.popped ? (
            <span className={styles.burst} aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <span
                  key={i}
                  className={styles.particle}
                  style={{ '--angle': `${i * 45}deg` } as React.CSSProperties}
                />
              ))}
            </span>
          ) : (
            <svg viewBox="0 0 60 108" aria-hidden="true">
              <path
                d="M30 2 C13 2 8 16 8 27 C8 40 20 50 27 52 L25 57 L35 57 L33 52 C40 50 52 40 52 27 C52 16 47 2 30 2 Z"
                fill="currentColor"
              />
              <ellipse cx="21" cy="18" rx="6" ry="9" fill="#FFFFFF" opacity="0.32" />
              <path
                d="M30 57 C30 70 22 74 26 84 C29 92 34 96 32 106"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                opacity="0.55"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      ))}

      <div className={styles.blueWrap}>
        <div className={styles.bubble} key={bubbleLine}>
          {bubbleLine}
        </div>
        <Image
          src="/blue/blue-home.png"
          alt="Blue, the Academy mascot"
          width={742}
          height={705}
          priority
          className={styles.blueImage}
        />
      </div>
    </section>
  );
}
