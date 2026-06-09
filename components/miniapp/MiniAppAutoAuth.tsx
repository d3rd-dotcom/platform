'use client';

import { useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useLoginToMiniApp } from '@privy-io/react-auth/farcaster';
import { sdk } from '@farcaster/miniapp-sdk';

/**
 * Global, silent Farcaster mini-app auto-sign-in.
 *
 * When the app runs inside a Farcaster mini-app host, this signs the user in
 * automatically using the mini-app SDK's native Sign-In-With-Farcaster
 * (`sdk.actions.signIn`) — no Privy modal, no browser popup. The SIWF message
 * is produced by the host's miniapp SDK; Privy's headless `loginToMiniApp` is
 * only used to mint our server session token (server auth is Privy-JWT based).
 *
 * This runs app-wide (mounted in the authenticated shell) so users are signed
 * in on whatever page they land on, instead of hitting a Privy login popup.
 * Renders nothing.
 */
export default function MiniAppAutoAuth() {
  const { ready, authenticated, getAccessToken, user } = usePrivy();
  const { initLoginToMiniApp, loginToMiniApp } = useLoginToMiniApp();
  const attempted = useRef(false);
  const sessionEnsured = useRef(false);

  // 1. Silent SIWF login via the mini-app SDK (only when not already signed in).
  useEffect(() => {
    if (!ready || authenticated || attempted.current) return;
    attempted.current = true;

    (async () => {
      try {
        const inMiniApp = await sdk.isInMiniApp();
        if (!inMiniApp) return;

        const { nonce } = await initLoginToMiniApp();
        const result = await sdk.actions.signIn({ nonce });
        if (result?.message && result?.signature) {
          await loginToMiniApp({
            message: result.message,
            signature: result.signature,
          });
        }
      } catch (err) {
        console.error('[MiniAppAutoAuth] Farcaster SIWF login failed:', err);
      }
    })();
  }, [ready, authenticated, initLoginToMiniApp, loginToMiniApp]);

  // 2. Once authenticated, ensure a server-side user row exists and back-fill
  //    Farcaster profile data. Idempotent; runs once per session.
  useEffect(() => {
    if (!authenticated || sessionEnsured.current) return;
    sessionEnsured.current = true;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const fcProfile = user?.farcaster;
        const res = await fetch('/api/auth/wallet-signup', {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            farcasterUsername: fcProfile?.username || undefined,
            farcasterPfp: fcProfile?.pfp || undefined,
          }),
        });
        if (res.ok) {
          window.dispatchEvent(new Event('profileUpdated'));
        }
      } catch (err) {
        console.error('[MiniAppAutoAuth] Session ensure failed:', err);
      }
    })();
  }, [authenticated, getAccessToken, user]);

  return null;
}
