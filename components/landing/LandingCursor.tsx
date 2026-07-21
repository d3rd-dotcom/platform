'use client';

import { useEffect } from 'react';

// Animated pixel-art cursor for the landing page: cycles three arrow frames
// (cyan shimmer sweeping down the blade). Desktop fine pointers only; a
// static frame is used under reduced motion. Frames live in
// public/landing/cursor and are swapped via a rewritten <style> rule so
// descendants with their own cursor declarations are covered too.
const FRAMES = [
  '/landing/cursor/blue-cursor-1.png',
  '/landing/cursor/blue-cursor-2.png',
  '/landing/cursor/blue-cursor-3.png',
];
const FRAME_MS = 320;

const ruleFor = (frame: string) =>
  `[data-landing-page], [data-landing-page] * { cursor: url(${frame}) 2 2, auto !important; }`;

export const LandingCursor: React.FC = () => {
  useEffect(() => {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!finePointer) return;

    FRAMES.forEach((src) => {
      const img = new Image();
      img.src = src;
    });

    const style = document.createElement('style');
    document.head.appendChild(style);
    style.textContent = ruleFor(FRAMES[0]);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let interval = 0;
    if (!reducedMotion) {
      let i = 0;
      interval = window.setInterval(() => {
        i = (i + 1) % FRAMES.length;
        style.textContent = ruleFor(FRAMES[i]);
      }, FRAME_MS);
    }

    return () => {
      window.clearInterval(interval);
      style.remove();
    };
  }, []);

  return null;
};

export default LandingCursor;
