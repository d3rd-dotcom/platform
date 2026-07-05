'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import styles from './LandingPage.module.css';

const CubesCanvas = dynamic(() => import('./CohortCubes'), { ssr: false });

function canUseWebGl(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function LandingSceneFallback() {
  return <div className={`${styles.canvas} ${styles.canvasFallback}`} aria-hidden="true" />;
}

class LandingSceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <LandingSceneFallback />;
    }
    return this.props.children;
  }
}

export const LandingScene: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [webGlReady, setWebGlReady] = useState<boolean | null>(null);
  // Wait until the browser is idle before mounting the WebGL canvas, so the
  // hero text + image paint first (LCP) instead of competing with Three.js
  // download/parse/init on the critical path.
  const [idle, setIdle] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Only animate while the hero is actually on screen; a continuously running
  // render loop while scrolled away is wasted main-thread work (hurts INP).
  const [inView, setInView] = useState(true);

  useEffect(() => {
    setWebGlReady(canUseWebGl());
    setReducedMotion(prefersReducedMotion());

    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => setIdle(true), { timeout: 2000 });
      return () => win.cancelIdleCallback?.(id);
    }

    const id = window.setTimeout(() => setIdle(true), 900);
    return () => window.clearTimeout(id);
  }, []);

  // Pause/resume based on viewport visibility.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '100px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (webGlReady === false) {
    return <LandingSceneFallback />;
  }

  const shouldMount = webGlReady === true && idle;

  return (
    <LandingSceneErrorBoundary>
      <div ref={containerRef} className={styles.canvas}>
        {shouldMount ? (
          <CubesCanvas bgColor="#5168FF" animate={inView && !reducedMotion} />
        ) : null}
      </div>
    </LandingSceneErrorBoundary>
  );
};

export default LandingScene;
