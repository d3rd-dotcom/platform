'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { usePrivy } from '@privy-io/react-auth';
import { useDevMode } from '../useDevMode';
import WelcomePremiumModal from './WelcomePremiumModal';

/**
 * Decides when to show the "Welcome to Premium" screen.
 *
 * On mount it asks the server whether this wallet has a delivered membership it
 * has not been welcomed for; if so, the screen is shown once and dismissal is
 * recorded server-side. A dev-only button re-opens it as a preview (a preview
 * dismissal is not recorded, so the real one-time trigger is preserved).
 */
const WelcomePremiumGate: React.FC = () => {
  const { getAccessToken } = usePrivy();
  const devMode = useDevMode();
  const [open, setOpen] = useState(false);
  const [isPreview, setIsPreview] = useState(false);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    try {
      const token = await getAccessToken();
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch {
      return {};
    }
  }, [getAccessToken]);

  // Ask the server whether the welcome screen is owed to this buyer.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/membership/welcome-status', {
          credentials: 'include',
          headers: await authHeaders(),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data?.show) {
          setIsPreview(false);
          setOpen(true);
        }
      } catch {
        /* no welcome screen if the check fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  const handleClose = useCallback(async () => {
    setOpen(false);
    // A dev preview must not consume the real one-time trigger.
    if (isPreview) return;
    try {
      await fetch('/api/membership/welcome-status', {
        method: 'POST',
        credentials: 'include',
        headers: await authHeaders(),
      });
    } catch {
      /* if marking fails the screen simply shows again next login */
    }
  }, [authHeaders, isPreview]);

  return (
    <>
      <AnimatePresence>
        {open && <WelcomePremiumModal onClose={handleClose} />}
      </AnimatePresence>

      {devMode && !open && (
        <button
          type="button"
          onClick={() => {
            setIsPreview(true);
            setOpen(true);
          }}
          style={{
            position: 'fixed',
            right: 12,
            bottom: 12,
            zIndex: 900,
            fontSize: 11,
            padding: '5px 9px',
            borderRadius: 6,
            border: '1px solid #444',
            background: '#1c1c22',
            color: '#dde',
            cursor: 'pointer',
          }}
        >
          dev: welcome screen
        </button>
      )}
    </>
  );
};

export default WelcomePremiumGate;
