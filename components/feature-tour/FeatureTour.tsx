'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './FeatureTour.module.css';

/**
 * A one-time spotlight tour of the home dashboard. Runs after onboarding,
 * tablet and desktop only. Each step dims the screen and highlights one
 * feature with a callout. Targets are marked with `data-tour="<id>"`.
 */

const SEEN_KEY = 'mwa-feature-tour-seen';
const MIN_WIDTH = 768; // tablet + desktop only

interface TourStep {
  /** data-tour id of the element to highlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    title: 'Welcome to Mental Wealth Academy',
    body: "Here's a 30-second tour of the parts that matter most. You can skip it anytime.",
  },
  {
    target: 'shards',
    title: 'Gems are your rewards',
    body: 'You earn gems for real activity — surveys, course milestones, streaks, and quests. This is your running balance.',
  },
  {
    target: 'journal',
    title: 'Journal to earn',
    body: 'Morning pages are quick reflective writing that builds your streak and earns gems. A few minutes pays off.',
  },
  {
    target: 'markets',
    title: 'VIP markets desk',
    body: 'VIP members can open the markets desk to review Blue signals, treasury routing, and live execution history.',
  },
  {
    target: 'quests',
    title: 'Take on quests',
    body: 'Quests are bite-size challenges. Complete them to earn gems and keep your momentum going.',
  },
  {
    target: 'vip',
    title: 'VIP membership',
    body: 'VIP unlocks research tools, grants, and community funds — built for members doing serious science.',
  },
  {
    target: 'ask-blue',
    title: 'Ask Blue anytime',
    body: 'Blue is your AI research partner. Open her whenever you have a question — she knows MWA and remembers your past chats.',
  },
];

export default function FeatureTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const calloutRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const finish = useCallback(() => {
    setStorageItem(SEEN_KEY, '1');
    setActive(false);
  }, []);

  const next = useCallback(() => {
    setStepIndex((s) => {
      if (s >= STEPS.length - 1) {
        finish();
        return s;
      }
      return s + 1;
    });
  }, [finish]);

  const back = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1));
  }, []);

  // Run once, tablet+desktop only, after the dashboard has rendered.
  useEffect(() => {
    if (getStorageItem(SEEN_KEY)) return;
    if (typeof window === 'undefined' || window.innerWidth < MIN_WIDTH) return;

    let cancelled = false;
    let tries = 0;
    const poll = () => {
      if (cancelled) return;
      // The VIP card is the last target to mount, so it gates "ready".
      if (document.querySelector('[data-tour="vip"]')) {
        setActive(true);
        return;
      }
      if (tries++ > 50) return; // ~20s, then give up quietly
      window.setTimeout(poll, 400);
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, []);

  // Locate the current target and scroll it into view.
  useEffect(() => {
    if (!active) return;
    if (!step.target) {
      setRect(null);
      return;
    }

    let cancelled = false;
    let tries = 0;
    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        window.setTimeout(() => {
          if (!cancelled) setRect(el.getBoundingClientRect());
        }, 300);
        return;
      }
      if (tries++ > 12) {
        // Target never appeared (e.g. hidden at this width) — move on.
        if (stepIndex < STEPS.length - 1) setStepIndex((s) => s + 1);
        else finish();
        return;
      }
      window.setTimeout(locate, 120);
    };
    locate();
    return () => {
      cancelled = true;
    };
  }, [active, step.target, stepIndex, finish]);

  // Keep the highlight aligned as the page scrolls or resizes.
  useEffect(() => {
    if (!active || !step.target) return;
    const sync = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) setRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', sync);
    window.addEventListener('scroll', sync, true);
    return () => {
      window.removeEventListener('resize', sync);
      window.removeEventListener('scroll', sync, true);
    };
  }, [active, step.target]);

  // Close the tour if the viewport drops below tablet size.
  useEffect(() => {
    if (!active) return;
    const onResize = () => {
      if (window.innerWidth < MIN_WIDTH) finish();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, finish]);

  // Keyboard controls.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, back, finish]);

  // Position the callout near the target, or centered when there is none.
  useEffect(() => {
    const el = calloutRef.current;
    if (!el) return;
    const margin = 16;
    const gap = 14;
    const cw = el.offsetWidth;
    const ch = el.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top: number;
    let left: number;

    if (!rect) {
      top = Math.max(margin, (vh - ch) / 2);
      left = Math.max(margin, (vw - cw) / 2);
    } else if (vw - rect.right >= cw + gap + margin) {
      left = rect.right + gap;
      top = rect.top + rect.height / 2 - ch / 2;
    } else if (rect.left >= cw + gap + margin) {
      left = rect.left - gap - cw;
      top = rect.top + rect.height / 2 - ch / 2;
    } else if (vh - rect.bottom >= ch + gap + margin) {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - cw / 2;
    } else {
      top = rect.top - gap - ch;
      left = rect.left + rect.width / 2 - cw / 2;
    }

    top = Math.min(Math.max(margin, top), vh - ch - margin);
    left = Math.min(Math.max(margin, left), vw - cw - margin);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.opacity = '1';
  }, [rect, stepIndex, active]);

  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Feature tour">
      <div className={`${styles.scrim} ${rect ? '' : styles.scrimSolid}`} />

      {rect && (
        <div
          className={styles.spotlight}
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}

      <div ref={calloutRef} className={styles.callout}>
        <span className={styles.stepCount}>
          {stepIndex + 1} of {STEPS.length}
        </span>
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.actions}>
          <span className={styles.skipSlot}>
            {!isLast && (
              <button type="button" className={styles.skip} onClick={finish}>
                Skip tour
              </button>
            )}
          </span>
          <span className={styles.navBtns}>
            {stepIndex > 0 && (
              <button type="button" className={styles.back} onClick={back}>
                Back
              </button>
            )}
            <button type="button" className={styles.next} onClick={next}>
              {isLast ? 'Got it' : 'Next'}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
