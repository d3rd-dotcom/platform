'use client';

import dynamic from 'next/dynamic';
import { Component, type ReactNode, useEffect, useState } from 'react';
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
  const [webGlReady, setWebGlReady] = useState<boolean | null>(null);

  useEffect(() => {
    setWebGlReady(canUseWebGl());
  }, []);

  if (webGlReady === false) {
    return <LandingSceneFallback />;
  }

  return (
    <LandingSceneErrorBoundary>
      <div className={styles.canvas}>
        {webGlReady ? <CubesCanvas bgColor="#FBF8FF" /> : null}
      </div>
    </LandingSceneErrorBoundary>
  );
};

export default LandingScene;
