'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './TextScramble.module.css';

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

export interface TextScrambleProps {
  /** Final text the effect settles on. */
  text: string;
  /** Total time from first character locking to the last, in ms. */
  duration?: number;
  /** Play automatically on mount. Set false to trigger via the `play` key changing. */
  autoPlay?: boolean;
  /** Bumping this value re-runs the scramble (e.g. when `text` changes). */
  playKey?: string | number;
  className?: string;
  /**
   * Locks to a monospace/tabular font so per-character churn never jitters
   * the surrounding layout — right for compact UI text (stats, labels).
   * Set false to inherit the parent's font and wrap normally, for running
   * text like a headline; width jitter during the brief decode is an
   * acceptable trade for keeping the real typography. Defaults to true.
   */
  monospace?: boolean;
}

/**
 * Cycles random glyphs per character, locking in the real character left to
 * right on a per-character settle deadline. Renders instantly under
 * prefers-reduced-motion. The scrambling glyphs are aria-hidden; the final
 * string is exposed via aria-label on the wrapper.
 */
export default function TextScramble({
  text,
  duration = 600,
  autoPlay = true,
  playKey,
  className = '',
  monospace = true,
}: TextScrambleProps) {
  const [display, setDisplay] = useState(text);
  const [reduceMotion, setReduceMotion] = useState(false);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mql.matches);
    const onChange = () => setReduceMotion(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (!autoPlay) return undefined;

    if (reduceMotion) {
      setDisplay(text);
      return undefined;
    }

    const chars = text.split('');
    const settleAt = chars.map((_, i) => (i / Math.max(chars.length, 1)) * duration);
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const next = chars
        .map((char, i) => {
          if (char === ' ') return ' ';
          if (elapsed >= settleAt[i]) return char;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        })
        .join('');
      setDisplay(next);

      if (elapsed < duration) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(text);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, duration, autoPlay, reduceMotion, playKey]);

  const spans = useMemo(() => display.split(''), [display]);

  const wrapperClass = [styles.scramble, monospace ? styles.monospace : '', className]
    .filter(Boolean)
    .join(' ');
  const charClass = monospace ? styles.char : styles.charFluid;

  return (
    <span className={wrapperClass} role="text" aria-label={text}>
      <span aria-hidden="true">
        {spans.map((char, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <span key={i} className={charClass}>
            {char === ' ' ? ' ' : char}
          </span>
        ))}
      </span>
    </span>
  );
}
