'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';

interface HomeWelcomeFlowProps {
  children: React.ReactNode;
  onAuthenticated?: () => void;
  onSettled?: () => void;
}

/**
 * Wraps the home page content.
 * - Checks server session (which now also reads Privy cookie on the server).
 * - Mini-app auto-sign-in (silent SIWF via the mini-app SDK) is handled
 *   globally by MiniAppAutoAuth; this component just reacts to `authenticated`.
 * - Privy-authenticated: auto-creates server session via wallet-signup.
 * - No auth: renders page content (no redirect).
 *
 * NOTE: This component does NOT render its own OnboardingModal. That's owned
 * by AcademyAccessGate (wraps the entire app). When AcademyAccessGate's modal
 * completes it dispatches a 'profileUpdated' event — we listen for it here
 * to call onAuthenticated.
 */
export default function HomeWelcomeFlow({ children, onAuthenticated, onSettled }: HomeWelcomeFlowProps) {
  const router = useRouter();
  const { ready, authenticated, getAccessToken, user } = usePrivy();

  const [authState, setAuthState] = useState<'checking' | 'ready'>('checking');
  const settledRef = useRef(false);

  useEffect(() => {
    if (!ready) return;

    (async () => {
      try {
        // 1. If Privy says authenticated, check existing user via server
        if (authenticated) {
          const token = await getAccessToken();
          const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch('/api/me', {
            credentials: 'include',
            cache: 'no-store',
            headers: authHeaders,
          });
          const data = await res.json().catch(() => ({ user: null }));
          if (data?.user) {
            if (data.user.onboardingComplete) {
              setAuthState('ready');
              onAuthenticated?.();
            } else {
              setAuthState('ready');
            }
            return;
          }
        }

        // 2. Privy-authenticated (incl. silent mini-app SIWF handled by
        //    MiniAppAutoAuth) — create server session automatically.
        if (authenticated) {
          const token = await getAccessToken();
          if (!token) {
            setAuthState('ready');
            return;
          }
          const authHeaders: HeadersInit = { Authorization: `Bearer ${token}` };

          // Back-fill Farcaster profile data on the server session
          const fcProfile = user?.farcaster;
          const signupRes = await fetch('/api/auth/wallet-signup', {
            method: 'POST',
            credentials: 'include',
            headers: {
              ...authHeaders,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              farcasterUsername: fcProfile?.username || undefined,
              farcasterPfp: fcProfile?.pfp || undefined,
            }),
          });

          if (signupRes.ok) {
            window.dispatchEvent(new Event('profileUpdated'));
            const meRes = await fetch('/api/me', {
              credentials: 'include',
              cache: 'no-store',
              headers: authHeaders,
            });
            const meData = await meRes.json().catch(() => ({ user: null }));
            if (meData?.user?.onboardingComplete) {
              setAuthState('ready');
              onAuthenticated?.();
            } else {
              setAuthState('ready');
            }
            return;
          }
        }

        // 3. No auth — still render the page (let individual components handle auth)
        setAuthState('ready');
      } catch (err) {
        console.error('[HomeWelcomeFlow] Auth check error:', err);
        setAuthState('ready');
      }
    })();
  }, [ready, authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for profileUpdated dispatched by AcademyAccessGate's modal
  useEffect(() => {
    const handler = () => {
      onAuthenticated?.();
    };
    window.addEventListener('profileUpdated', handler);
    return () => window.removeEventListener('profileUpdated', handler);
  }, [onAuthenticated]);

  useEffect(() => {
    if (authState !== 'checking' && !settledRef.current) {
      settledRef.current = true;
      onSettled?.();
    }
  }, [authState]); // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>;
}
