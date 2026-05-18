'use client';

import { useEffect } from 'react';

export default function PwaRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    const isLocalHost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname === '::1' ||
      window.location.hostname === '[::1]';

    if (process.env.NODE_ENV !== 'production' || isLocalHost) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.filter((key) => key.startsWith('mwa-')).map((key) => caches.delete(key))))
        .catch((error) => console.error('PWA service worker cleanup failed', error));
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
