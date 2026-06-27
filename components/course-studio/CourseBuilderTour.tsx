'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './CourseBuilderTour.module.css';

const SEEN_KEY = 'mwa-builder-tour-seen';

const STEPS = [
  {
    target: 'builder-title',
    title: 'Name your course',
    body: 'Start by giving your course a title and slug. This is how students will find it.',
    cta: 'Next',
  },
  {
    target: 'builder-palette',
    title: 'Choose components',
    body: 'Every course is built from components. Drag any component from this list onto the canvas to add it to a week.',
    cta: 'Next',
  },
  {
    target: 'builder-canvas',
    title: 'Build your weeks',
    body: 'Each week holds its own set of components. Click a component to open its settings and add your content.',
    cta: 'Next',
  },
  {
    target: 'builder-inspector',
    title: 'Edit content',
    body: 'The inspector lets you write content, configure options, and adjust each component. Tap any component on the canvas to open it.',
    cta: 'Done',
  },
];

export default function CourseBuilderTour() {
  const [show, setShow] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const calloutRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  const finish = useCallback(() => {
    setStorageItem(SEEN_KEY, '1');
    setRect(null);
    setShow(false);
  }, []);

  const next = useCallback(() => {
    if (isLast) {
      finish();
      return;
    }
    setStepIndex((s) => s + 1);
  }, [isLast, finish]);

  const back = useCallback(() => {
    setStepIndex((s) => Math.max(0, s - 1));
  }, []);

  // Decide whether to show on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getStorageItem(SEEN_KEY) === '1') return;

    let cancelled = false;
    let tries = 0;
    const poll = () => {
      if (cancelled) return;
      if (document.querySelector(`[data-tour="${STEPS[0].target}"]`)) {
        setStepIndex(0);
        setShow(true);
        return;
      }
      if (tries++ > 50) return;
      window.setTimeout(poll, 400);
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  // Locate the current target
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    let tries = 0;
    const locate = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (!el) {
        if (tries++ > 25) return;
        window.setTimeout(locate, 200);
        return;
      }
      el.scrollIntoView({ block: 'center', behavior: 'auto' });
      if (!cancelled) setRect(el.getBoundingClientRect());
    };
    locate();
    return () => { cancelled = true; };
  }, [show, step.target]);

  // Keep the spotlight aligned
  useEffect(() => {
    if (!show) return;
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
  }, [show, step.target]);

  // Keyboard controls
  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, next, back, finish]);

  // Position callout
  useEffect(() => {
    if (!show) return;
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
    } else if (rect.top >= ch + gap + margin) {
      top = rect.top - gap - ch;
      left = rect.left + rect.width / 2 - cw / 2;
    } else {
      top = rect.bottom + gap;
      left = rect.left + rect.width / 2 - cw / 2;
    }

    top = Math.min(Math.max(margin, top), vh - ch - margin);
    left = Math.min(Math.max(margin, left), vw - cw - margin);
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.opacity = '1';
  }, [rect, stepIndex, show]);

  if (typeof document === 'undefined' || !show) return null;

  const overlayNode = (
    <div className={styles.root} role="dialog" aria-modal="true" aria-label="Course builder tour">
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
        <div className={styles.headerRow}>
          <span className={styles.stepBadge}>
            {stepIndex + 1} of {STEPS.length}
          </span>
        </div>
        <h3 className={styles.title}>{step.title}</h3>
        <p className={styles.body}>{step.body}</p>
        <div className={styles.actions}>
          <span className={styles.skipSlot}>
            <button type="button" className={styles.skip} onClick={finish}>
              Skip
            </button>
          </span>
          <span className={styles.navBtns}>
            {stepIndex > 0 && (
              <button type="button" className={styles.back} onClick={back}>
                Back
              </button>
            )}
            <button type="button" className={styles.next} onClick={next}>
              {step.cta}
            </button>
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(overlayNode, document.body);
}
