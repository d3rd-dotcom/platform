'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      } catch (error) {
        console.error('PWA service worker registration failed', error);
      }
    };

    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => void registerServiceWorker(), { timeout: 2500 });
      return () => window.cancelIdleCallback(id);
    }

    const id = setTimeout(() => void registerServiceWorker(), 1500);
    return () => clearTimeout(id);
  }, []);

  return null;
}
