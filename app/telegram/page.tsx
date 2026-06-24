'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import Button from '@/components/button/Button';
import styles from './page.module.css';

type Step = 'linking' | 'verifying' | 'approved' | 'denied' | 'error';

export default function TelegramPage() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();

  const [step, setStep] = useState<Step | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const telegramAccount = useMemo(
    () => user?.linkedAccounts?.find((a: any) => a.type === 'telegram'),
    [user],
  );
  const hasTelegramLinked = !!telegramAccount;
  const telegramUsername = (telegramAccount as any)?.username || null;

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) return;

    if (!hasTelegramLinked) {
      setStep(null);
    } else if (step === null) {
      setStep(null);
    }
  }, [ready, authenticated, hasTelegramLinked, step]);

  const handleLinkTelegram = useCallback(() => {
    login({ loginMethods: ['telegram'] });
  }, [login]);

  const handleVerify = useCallback(async () => {
    setStep('verifying');
    setErrorMessage(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setStep('error');
        setErrorMessage('Could not get auth token. Please try signing in again.');
        return;
      }

      const res = await fetch('/api/telegram/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setStep('error');
        setErrorMessage(data.error || `Server error (${res.status})`);
        return;
      }

      setStep(data.approved ? 'approved' : 'denied');
    } catch (err) {
      setStep('error');
      setErrorMessage(err instanceof Error ? err.message : 'Verification request failed');
    }
  }, [getAccessToken]);

  const handleLogin = useCallback(() => {
    login();
  }, [login]);

  if (!ready) {
    return (
      <div className={styles.page}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.card}>
            <div className={styles.spinner} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <SideNavigation />
      <main className={styles.main}>
        <div className={styles.card}>
          <div className={styles.icon}>
            {!authenticated && '🔐'}
            {authenticated && !hasTelegramLinked && '🔗'}
            {authenticated && hasTelegramLinked && step === null && '🎓'}
            {step === 'linking' && '🔗'}
            {step === 'verifying' && '⏳'}
            {step === 'approved' && '✅'}
            {step === 'denied' && '🚫'}
            {step === 'error' && '⚠️'}
          </div>

          <h1 className={styles.title}>Telegram Channel Access</h1>
          <p className={styles.subtitle}>
            Verify your Academic Angel NFT to access the private MWA Telegram channel.
          </p>

          {!authenticated && (
            <>
              <p className={styles.description}>
                Sign in to your MWA account to link Telegram and verify your NFT.
              </p>
              <Button fullWidth onClick={handleLogin}>
                Sign In
              </Button>
            </>
          )}

          {authenticated && !hasTelegramLinked && (
            <>
              <p className={styles.description}>
                Link your Telegram account to your MWA profile. This connects your
                Telegram identity to your wallet so we can verify your NFT.
              </p>
              <Button
                fullWidth
                onClick={handleLinkTelegram}
              >
                Link Telegram Account
              </Button>
            </>
          )}

          {authenticated && hasTelegramLinked && step === null && (
            <>
              <div className={styles.badge}>
                ✅ Telegram linked
                {telegramUsername && <span> — @{telegramUsername}</span>}
              </div>
              <p className={styles.description}>
                Your Telegram account is linked. Click below to check your
                Academic Angel NFT and gain channel access.
              </p>
              <Button fullWidth onClick={handleVerify}>
                Verify Access
              </Button>
            </>
          )}

          {step === 'verifying' && (
            <>
              <div className={styles.spinner} />
              <p className={styles.description}>Checking NFT ownership...</p>
            </>
          )}

          {step === 'approved' && (
            <>
              <div className={styles.badge} data-variant="success">
                ✅ Access Granted
              </div>
              <p className={styles.description}>
                You&apos;re verified as an Academic Angel holder. Go back to
                Telegram and click the <strong>Join</strong> button on the
                channel — the bot will send you a one-time invite link.
              </p>
            </>
          )}

          {step === 'denied' && (
            <>
              <div className={styles.badge} data-variant="error">
                ❌ No Academic Angel Found
              </div>
              <p className={styles.description}>
                The wallet linked to your Telegram account doesn&apos;t hold an
                Academic Angel NFT. You need one to access the channel.
              </p>
              <Button fullWidth onClick={handleVerify}>
                Try Again
              </Button>
            </>
          )}

          {step === 'error' && (
            <>
              <div className={styles.badge} data-variant="error">
                ⚠️ Error
              </div>
              <p className={styles.description}>
                {errorMessage || 'Something went wrong during verification.'}
              </p>
              <Button fullWidth onClick={handleVerify}>
                Try Again
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
