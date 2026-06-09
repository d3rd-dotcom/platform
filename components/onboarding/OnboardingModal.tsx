'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { usePrivy } from '@privy-io/react-auth';
import { setStorageItem } from '@/lib/safe-storage';
import styles from './OnboardingModal.module.css';

interface Avatar {
  id: string;
  image_url: string;
  metadata_url: string;
}

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: (username: string, avatarUrl: string | null) => void;
}

const genderOptions = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'nonbinary', label: 'Non-binary' },
  { value: 'private', label: 'Prefer not to say' },
] as const;

const OnboardingModal: React.FC<OnboardingModalProps> = ({ isOpen, onClose, onComplete }) => {
  const { address } = useAccount();
  const { getAccessToken, authenticated, login } = usePrivy();
  const [step, setStep] = useState<'details' | 'avatar' | 'shards'>('details');
  const [hasSession, setHasSession] = useState(false);
  // Gate the onboarding questions behind a confirmed account. The questions
  // must never be answerable before an account exists on the server.
  const [authStatus, setAuthStatus] = useState<'checking' | 'ready' | 'needs-signin'>('checking');

  const [avatars, setAvatars] = useState<Avatar[]>([]);
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [loadingAvatars, setLoadingAvatars] = useState(true);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const [username, setUsername] = useState('');
  const [gender, setGender] = useState('');
  const [birthday, setBirthday] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const checkingRef = useRef<string | null>(null);

  const usernameRegex = useMemo(() => /^[a-zA-Z0-9_]{5,32}$/, []);
  const isUsernameValid = usernameRegex.test(username);
  const isDetailsValid =
    isUsernameValid &&
    usernameAvailable !== false &&
    !checkingUsername &&
    !!gender &&
    !!birthday;

  // On open, confirm an account exists on the server BEFORE showing any
  // questions. If the user is signed in with Privy but has no server account
  // yet, create it now (wallet-signup). Otherwise prompt them to sign in.
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setAuthStatus('checking');

    (async () => {
      try {
        const token = await getAccessToken();
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        let res = await fetch('/api/me', {
          credentials: 'include',
          cache: 'no-store',
          headers: authHeaders,
        });
        let data = await res.json().catch(() => ({ user: null }));

        // Signed in with Privy but no server account row yet — create it.
        if (!data?.user && token) {
          await fetch('/api/auth/wallet-signup', {
            method: 'POST',
            credentials: 'include',
            headers: authHeaders,
          }).catch(() => {});
          res = await fetch('/api/me', {
            credentials: 'include',
            cache: 'no-store',
            headers: authHeaders,
          });
          data = await res.json().catch(() => ({ user: null }));
        }

        if (cancelled) return;
        if (data?.user) {
          setHasSession(true);
          setAuthStatus('ready');
        } else {
          setAuthStatus('needs-signin');
        }
      } catch (err) {
        console.error('Onboarding account check failed:', err);
        if (!cancelled) setAuthStatus('needs-signin');
      }
    })();

    return () => { cancelled = true; };
  }, [isOpen, authenticated, getAccessToken]);

  useEffect(() => {
    if (!isOpen || authStatus !== 'ready') return;
    const fetchAvatars = async () => {
      setLoadingAvatars(true);
      setAvatarError(null);
      try {
        const token = await getAccessToken();
        const response = await fetch('/api/avatars/choices', {
          cache: 'no-store',
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load avatars');
        }
        setAvatars(data.choices || []);
      } catch (err: any) {
        console.error('Failed to fetch avatars:', err);
        setAvatarError(err?.message || 'Failed to load avatars');
      } finally {
        setLoadingAvatars(false);
      }
    };
    fetchAvatars();
  }, [isOpen, authStatus, getAccessToken]);

  const checkUsername = useCallback(async (name: string) => {
    if (checkingRef.current === name) return;
    if (!usernameRegex.test(name)) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      checkingRef.current = null;
      return;
    }
    checkingRef.current = name;
    setCheckingUsername(true);
    setUsernameAvailable(null);
    try {
      const response = await fetch(`/api/profile/check-username?username=${encodeURIComponent(name)}`);
      const data = await response.json();
      if (checkingRef.current !== name) return;
      if (typeof data.available === 'boolean') {
        setUsernameAvailable(data.available);
      } else {
        setUsernameAvailable(null);
      }
    } catch (err) {
      console.error('Username check error:', err);
      if (checkingRef.current === name) {
        setUsernameAvailable(null);
      }
    } finally {
      if (checkingRef.current === name) {
        setCheckingUsername(false);
        checkingRef.current = null;
      }
    }
  }, [usernameRegex]);

  useEffect(() => {
    if (!username || username.length < 5) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      checkingRef.current = null;
      return;
    }
    const timer = setTimeout(() => {
      if (username && username.length >= 5 && checkingRef.current !== username) {
        checkUsername(username);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [checkUsername, username]);

  useEffect(() => {
    if (isOpen) {
      setStep('details');
      setSelectedAvatarId(null);
      setUsername('');
      setGender('');
      setBirthday('');
      setError(null);
      setUsernameAvailable(null);
      setCheckingUsername(false);
      checkingRef.current = null;
    }
  }, [isOpen]);

  const handleUsernameChange = (value: string) => {
    setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ''));
    setUsernameAvailable(null);
    setError(null);
  };

  const handleSignIn = useCallback(async () => {
    setError(null);
    try {
      await login();
    } catch (err) {
      console.error('Sign-in failed:', err);
      setError('Sign-in failed. Please try again.');
    }
  }, [login]);

  const handleDetailsContinue = () => {
    setError(null);
    if (!isUsernameValid) {
      setError('Username must be 5-32 characters (letters, numbers, underscores)');
      return;
    }
    if (usernameAvailable === false) {
      setError('This username is already taken');
      return;
    }
    if (!gender || !birthday) {
      setError('Please complete your gender and birthday.');
      return;
    }
    setStep('avatar');
  };

  const handleAvatarContinue = () => {
    setError(null);
    if (!selectedAvatarId) {
      setError('Choose an avatar to continue.');
      return;
    }
    setStep('shards');
  };

  const handleSubmit = async () => {
    setError(null);

    if (!isUsernameValid) {
      setError('Username must be 5-32 characters (letters, numbers, underscores)');
      setStep('details');
      return;
    }
    if (usernameAvailable === false) {
      setError('This username is already taken');
      setStep('details');
      return;
    }
    if (!gender || !birthday) {
      setError('Please complete your gender and birthday.');
      setStep('details');
      return;
    }
    if (!selectedAvatarId) {
      setError('Choose an avatar to continue.');
      setStep('avatar');
      return;
    }
    if (!address && !hasSession) {
      setError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    setIsLoading(true);
    try {
      const token = await getAccessToken();
      const profileResponse = await fetch('/api/profile/create', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          username,
          gender,
          birthday,
          avatar_id: selectedAvatarId,
        }),
      });

      let profileData;
      try {
        const text = await profileResponse.text();
        profileData = text ? JSON.parse(text) : {};
      } catch {
        setError('Failed to create profile. Please try again.');
        setIsLoading(false);
        return;
      }

      if (profileResponse.ok) {
        const avatarUrl = profileData.user?.avatarUrl || null;
        window.dispatchEvent(new Event('profileUpdated'));
        // Signal the home first-run guide that this user just onboarded. Only
        // freshly onboarded users ever set this, so the Daily Note intro never
        // shows for existing accounts.
        setStorageItem('mwa-home-intro-pending', '1');
        if (onComplete) {
          onComplete(username, avatarUrl);
        } else {
          onClose();
        }
      } else {
        const errorMessage = profileData.message || profileData.error || 'Failed to create profile';
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Profile creation error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const progressWidth = step === 'details' ? '33.33%' : step === 'avatar' ? '66.66%' : '100%';
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {authStatus === 'checking' && (
          <div className={styles.stepContent}>
            <div className={styles.loadingState}>Setting up your account...</div>
          </div>
        )}

        {authStatus === 'needs-signin' && (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Create your account</h2>
            <p className={styles.stepDescription}>
              Sign in with your wallet to create your Academy account. You&apos;ll set up your profile right after.
            </p>
            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.primaryButton} onClick={handleSignIn}>
              Sign in to continue
            </button>
          </div>
        )}

        {authStatus === 'ready' && (
        <>
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: progressWidth }} />
        </div>

        {step === 'details' ? (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Profile Setup</h2>
            <p className={styles.stepDescription}>
              Choose your Academy name and tell us the basics we use to personalize research and rewards.
            </p>

            <div className={styles.formFields}>
              <div className={styles.inputGroup}>
                <label htmlFor="onboarding-username" className={styles.inputLabel}>Username</label>
                <div className={styles.inputWrapper}>
                  <span className={styles.inputPrefix}>@</span>
                  <input
                    id="onboarding-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="username"
                    className={styles.input}
                    maxLength={32}
                    autoComplete="username"
                    autoFocus
                  />
                  {checkingUsername && (
                    <span className={styles.inputSuffix}>
                      <div className={styles.spinner} />
                    </span>
                  )}
                  {!checkingUsername && usernameAvailable === true && (
                    <span className={`${styles.inputSuffix} ${styles.available}`}>✓</span>
                  )}
                  {!checkingUsername && usernameAvailable === false && (
                    <span className={`${styles.inputSuffix} ${styles.taken}`}>✗</span>
                  )}
                </div>
                <p className={styles.inputHint}>
                  5-32 characters, letters, numbers, and underscores
                </p>
              </div>

              <fieldset className={styles.inputGroup}>
                <legend>Gender</legend>
                <div className={styles.radioGroup}>
                  {genderOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`${styles.radioOption} ${gender === option.value ? styles.radioOptionChecked : ''}`}
                    >
                      <input
                        type="radio"
                        name="gender"
                        value={option.value}
                        checked={gender === option.value}
                        onChange={(e) => setGender(e.target.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className={styles.inputGroup}>
                <label htmlFor="onboarding-birthday" className={styles.inputLabel}>Birthday</label>
                <input
                  id="onboarding-birthday"
                  name="birthday"
                  type="date"
                  value={birthday}
                  max={today}
                  onChange={(e) => setBirthday(e.target.value)}
                  className={styles.input}
                />
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <button
              className={styles.primaryButton}
              onClick={handleDetailsContinue}
              disabled={!isDetailsValid}
            >
              Continue
            </button>
          </div>
        ) : step === 'avatar' ? (
          <div className={styles.stepContent}>
            <h2 className={styles.stepTitle}>Choose your avatar</h2>
            <p className={styles.stepDescription}>
              Select one of your assigned avatars. This becomes your Academy identity.
            </p>

            {loadingAvatars ? (
              <div className={styles.loadingState}>Loading avatars...</div>
            ) : avatarError ? (
              <div className={styles.error}>{avatarError}</div>
            ) : (
              <div className={styles.avatarGrid}>
                {avatars.map((avatar) => (
                  <button
                    key={avatar.id}
                    className={`${styles.avatarOption} ${selectedAvatarId === avatar.id ? styles.avatarSelected : ''}`}
                    onClick={() => setSelectedAvatarId(avatar.id)}
                    type="button"
                  >
                    <Image
                      src={avatar.image_url}
                      alt={avatar.id}
                      width={100}
                      height={100}
                      className={styles.avatarImage}
                      unoptimized
                    />
                    {selectedAvatarId === avatar.id && (
                      <div className={styles.avatarCheckmark}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                          <path d="M5 13l4 4L19 7" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryButton}
                onClick={() => setStep('details')}
                disabled={isLoading}
              >
                Back
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleAvatarContinue}
                disabled={!selectedAvatarId || loadingAvatars}
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.stepContent}>
            <div className={styles.shardHero}>
              <Image
                src="/icons/ui-diamond.svg"
                alt="Diamonds"
                width={88}
                height={88}
                className={styles.shardIcon}
              />
            </div>
            <h2 className={styles.stepTitle}>Earn diamonds, build real upside</h2>
            <p className={styles.stepDescription}>
              Diamonds are earned through meaningful Academy activity. Surveys and the 12-week course are the best starting paths because they turn your reflections, research participation, and completed lessons into diamond rewards.
            </p>

            <div className={styles.shardExplainer}>
              <div className={styles.explainerCard}>
                <h3>Earn</h3>
                <p>Complete surveys, finish course milestones, build streaks, and submit quests to grow your credit balance.</p>
              </div>
              <div className={styles.explainerCard}>
                <h3>Use</h3>
                <p>Use diamonds inside the AI prediction market to back forecasts and create ways to make real money.</p>
              </div>
              <div className={styles.explainerCard}>
                <h3>Unlock</h3>
                <p>VIP members can access research grants and community funds connected to Academy participation.</p>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}

            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryButton}
                onClick={() => setStep('avatar')}
                disabled={isLoading}
              >
                Back
              </button>
              <button
                className={styles.primaryButton}
                onClick={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Enter Academy'}
              </button>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default OnboardingModal;
