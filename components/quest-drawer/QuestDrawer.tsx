'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { X, CheckCircle, Circle, UploadSimple, ArrowSquareOut } from '@phosphor-icons/react';
import { ConfettiCelebration } from '../quests/ConfettiCelebration';
import { DiamondReward } from '../rewards/DiamondReward';
import { XConnectingModal } from '../x-connecting/XConnectingModal';
import type { QuestType } from '@/lib/quest-definitions';
import styles from './QuestDrawer.module.css';

export interface DrawerQuest {
  id: string;
  title: string;
  points: number;
  desc: string;
  rewardType: QuestType;
  targetCount?: number;
  progressCount?: number;
  claimedCount?: number;
  weekNumber?: number;
  icon?: string;
  authorLabel?: string;
  usdcReward?: number;
}

type UsdcClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';

interface UsdcClaimState {
  loading: boolean;
  reward: number;
  eligible: boolean;
  status: UsdcClaimStatus | null;
  txHash: string | null;
  note: string | null;
}

interface QuestDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  quest: DrawerQuest | null;
}

const KIND_META: Record<QuestType, { label: string; tone: string }> = {
  'sealed-week': { label: 'Course', tone: 'course' },
  'proof-required': { label: 'Submit', tone: 'submit' },
  'no-proof': { label: 'Mission', tone: 'mission' },
  'twitter-follow': { label: 'Social', tone: 'social' },
  'follow-and-own': { label: 'Social', tone: 'social' },
};

const QuestDrawer: React.FC<QuestDrawerProps> = ({ isOpen, onClose, quest }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const { getAccessToken } = usePrivy();
  const { address, isConnected } = useAccount();
  const [step1Completed, setStep1Completed] = useState(false);
  const [step2Completed, setStep2Completed] = useState(false);
  const [isCheckingFollow, setIsCheckingFollow] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showDiamondReward, setShowDiamondReward] = useState(false);
  // Cleanup to run once the player dismisses the reward dialogue.
  const afterRewardRef = useRef<(() => void) | null>(null);
  const [shardsAwarded, setShardsAwarded] = useState(0);
  const [showConnectingModal, setShowConnectingModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [usdcClaim, setUsdcClaim] = useState<UsdcClaimState | null>(null);
  const [isSubmittingUsdc, setIsSubmittingUsdc] = useState(false);

  const getAuthHeaders = async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const usdcReward = quest?.usdcReward ?? 0;

  // Load USDC bounty eligibility + existing claim state when the drawer opens
  // for a quest that carries a USDC reward.
  useEffect(() => {
    if (!isOpen || !quest || !usdcReward) {
      setUsdcClaim(null);
      return;
    }

    let cancelled = false;
    setUsdcClaim({ loading: true, reward: usdcReward, eligible: false, status: null, txHash: null, note: null });

    (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch(`/api/quests/usdc/submit?questId=${encodeURIComponent(quest.id)}`, {
          credentials: 'include',
          cache: 'no-store',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setUsdcClaim({
          loading: false,
          reward: data.usdcReward ?? usdcReward,
          eligible: Boolean(data.eligible),
          status: data.claim?.status ?? null,
          txHash: data.claim?.txHash ?? null,
          note: data.claim?.note ?? null,
        });
      } catch {
        if (!cancelled) {
          setUsdcClaim({ loading: false, reward: usdcReward, eligible: false, status: null, txHash: null, note: null });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, quest?.id, usdcReward]);

  const handleRequestUsdc = async () => {
    if (!quest || isSubmittingUsdc) return;
    setIsSubmittingUsdc(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/quests/usdc/submit', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ questId: quest.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setUsdcClaim((prev) => (prev ? { ...prev, status: 'pending', note: null } : prev));
      } else if (data?.claim?.status) {
        setUsdcClaim((prev) => (prev ? { ...prev, status: data.claim.status } : prev));
      } else {
        alert(data.error || 'Could not submit USDC bounty. Please try again.');
      }
    } catch {
      alert('Could not submit USDC bounty. Please try again.');
    } finally {
      setIsSubmittingUsdc(false);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };

    if (isOpen) {
      setShouldRender(true);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsAnimating(true));
      });
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => setShouldRender(false), 280);
      return () => clearTimeout(timer);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setSelectedFile(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!quest || quest.rewardType !== 'twitter-follow' || !isConnected) {
      setStep1Completed(false);
      setStep2Completed(false);
      return;
    }

    const checkXAccountAndFollow = async (autoCheckFollow = false) => {
      if (!isConnected || !address) {
        setStep1Completed(false);
        return;
      }

      try {
        const response = await fetch('/api/x-auth/status', {
          cache: 'no-store',
          credentials: 'include',
        });

        if (response.status === 401) {
          setStep1Completed(false);
          return;
        }

        const data = await response.json();
        const connected = data.connected === true;
        setStep1Completed(connected);

        if (connected && autoCheckFollow && !step2Completed) {
          const followResponse = await fetch('/api/x-auth/check-follow', {
            method: 'POST',
            cache: 'no-store',
            credentials: 'include',
          });
          const followData = await followResponse.json();

          if (followData.isFollowing) {
            setStep2Completed(true);

            try {
              const completeResponse = await fetch('/api/quests/auto-complete-twitter-quest', {
                method: 'POST',
                cache: 'no-store',
                credentials: 'include',
              });
              const completeData = await completeResponse.json();

              if (completeData.ok && completeData.shardsAwarded > 0) {
                setShardsAwarded(completeData.shardsAwarded);
                setShowConfetti(true);
                setShowDiamondReward(true);
                window.dispatchEvent(new Event('shardsUpdated'));
                setTimeout(() => setShowConfetti(false), 5000);
              }
            } catch (error) {
              console.error('Failed to auto-complete reward:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to check X account:', error);
        setStep1Completed(false);
      }
    };

    const params = new URLSearchParams(window.location.search);
    const autoCheck = params.get('auto_check');
    checkXAccountAndFollow(autoCheck === 'true');

    const handleFocus = () => checkXAccountAndFollow(true);
    const handleXAccountUpdate = () => checkXAccountAndFollow(true);

    window.addEventListener('focus', handleFocus);
    window.addEventListener('xAccountUpdated', handleXAccountUpdate);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('xAccountUpdated', handleXAccountUpdate);
    };
  }, [quest, isConnected, address, step2Completed]);

  const handleConnectTwitter = async () => {
    try {
      setShowConnectingModal(true);
      const response = await fetch('/api/x-auth/initiate', { credentials: 'include' });

      if (response.status === 401) {
        setShowConnectingModal(false);
        alert('Please sign in to connect your X account.');
        return;
      }

      if (!response.ok) {
        setShowConnectingModal(false);
        return;
      }

      const data = await response.json();
      if (data.authUrl) {
        setTimeout(() => { window.location.href = data.authUrl; }, 800);
      } else {
        setShowConnectingModal(false);
      }
    } catch (error) {
      console.error('Failed to connect X account:', error);
      setShowConnectingModal(false);
    }
  };

  const handleCheckFollow = async () => {
    setIsCheckingFollow(true);
    try {
      const response = await fetch('/api/x-auth/check-follow', {
        method: 'POST',
        cache: 'no-store',
        credentials: 'include',
      });
      const data = await response.json();

      if (data.isFollowing) {
        setStep2Completed(true);
      } else if (data.requiresManualVerification) {
        setStep2Completed(true);
      } else if (data.error) {
        alert(data.message || 'Failed to verify follow status. Please try again.');
      } else {
        alert('Please make sure you are following @MentalWealthDAO on X, then click Verify again.');
      }
    } catch (error) {
      console.error('Failed to check follow status:', error);
      alert('Failed to check follow status. Please try again.');
    } finally {
      setIsCheckingFollow(false);
    }
  };

  const handleCompleteReward = async () => {
    if (!quest) return;

    if ((quest.claimedCount ?? 0) >= (quest.targetCount ?? 1)) return;
    if (quest.rewardType === 'sealed-week' && (quest.progressCount ?? 0) < (quest.targetCount ?? 1)) return;
    if (quest.rewardType === 'twitter-follow' && (!step1Completed || !step2Completed)) return;

    setIsCompleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const shardReward = quest.points;
      const response = await fetch('/api/quests/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          questId: quest.id,
          shards: shardReward,
        }),
      });

      const data = await response.json();
      if (data.ok) {
        setShardsAwarded(shardReward);
        setShowConfetti(true);
        setShowDiamondReward(true);
        window.dispatchEvent(new Event('shardsUpdated'));
        afterRewardRef.current = () => {
          onClose();
          setShowConfetti(false);
          setShardsAwarded(0);
          setSelectedFile(null);
        };
      } else {
        alert(data.error || 'Failed to complete quest. Please try again.');
      }
    } catch (error) {
      console.error('Failed to complete quest:', error);
      alert('Failed to complete quest. Please try again.');
    } finally {
      setIsCompleting(false);
    }
  };

  if (!quest || !shouldRender) return null;

  const kindMeta = KIND_META[quest.rewardType] ?? KIND_META['no-proof'];
  const targetCount = quest.targetCount ?? 1;
  const progressCount = Math.min(quest.progressCount ?? 0, targetCount);
  const claimedCount = quest.claimedCount ?? 0;
  const questIsComplete = claimedCount >= targetCount;
  const canClaimSealedWeek = quest.rewardType === 'sealed-week' && progressCount >= targetCount && !questIsComplete;
  const progressPct = targetCount > 0 ? Math.min(100, (progressCount / targetCount) * 100) : 0;
  const statusLabel = questIsComplete ? 'Cleared' : progressCount > 0 ? 'In progress' : 'Available';

  return (
    <>
      <div
        className={`${styles.backdrop} ${isAnimating ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`${styles.drawer} ${isAnimating ? styles.drawerOpen : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Quest details"
        data-tone={kindMeta.tone}
      >
        {/* Drawer status bar */}
        <header className={styles.statusBar}>
          <div className={styles.statusBarLeft}>
            <span className={styles.statusKicker}>Quest dossier</span>
            <span className={styles.statusKind} data-tone={kindMeta.tone}>
              <span className={styles.statusKindDot} aria-hidden="true" />
              {kindMeta.label}
            </span>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close quest details"
          >
            <X size={16} weight="bold" />
          </button>
        </header>

        <div className={styles.scrollArea}>
          <section className={styles.heroPanel} data-tone={kindMeta.tone}>
            <div className={styles.heroIcon}>
              <Image
                src={quest.icon || '/icons/ui-diamond.svg'}
                alt=""
                width={40}
                height={40}
                className={styles.heroIconImg}
              />
            </div>
            <h1 className={styles.heroTitle}>{quest.title}</h1>
            <p className={styles.heroDesc}>{quest.desc}</p>
            {quest.authorLabel && (
              <span className={styles.authorTag}>{quest.authorLabel}</span>
            )}

            {usdcReward === 0 && (
              <div className={styles.rewardChip}>
                <Image src="/icons/ui-diamond.svg" alt="" width={16} height={16} />
                <span className={styles.rewardValue}>{quest.points}</span>
                <span className={styles.rewardLabel}>reflections</span>
              </div>
            )}
          </section>

          <section className={styles.metricRow}>
            <div className={styles.metricCell}>
              <span className={styles.metricLabel}>Progress</span>
              <span className={styles.metricValue}>
                {progressCount}<span className={styles.metricMuted}>/{targetCount}</span>
              </span>
              <div className={styles.metricBar}>
                <div className={styles.metricBarFill} style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            <div className={styles.metricCell}>
              <span className={styles.metricLabel}>Status</span>
              <span className={`${styles.metricValue} ${styles.metricValueStatus}`} data-status={questIsComplete ? 'done' : progressCount > 0 ? 'active' : 'idle'}>
                {statusLabel}
              </span>
            </div>
            <div className={styles.metricCell}>
              <span className={styles.metricLabel}>Claims</span>
              <span className={styles.metricValue}>
                {claimedCount}<span className={styles.metricMuted}>/{targetCount}</span>
              </span>
            </div>
          </section>

          {/* Action area — varies by quest type */}
          <section className={styles.actionPanel}>
            <div className={styles.actionHeading}>
              <span className={styles.actionEyebrow}>{'// objective'}</span>
              <h2 className={styles.actionTitle}>
                {quest.rewardType === 'sealed-week' && 'Seal the week'}
                {quest.rewardType === 'proof-required' && 'Submit your entry'}
                {quest.rewardType === 'no-proof' && 'Mark as complete'}
                {quest.rewardType === 'twitter-follow' && 'Connect & follow'}
                {quest.rewardType === 'follow-and-own' && 'Verify ownership'}
              </h2>
            </div>

            {quest.rewardType === 'sealed-week' && (
              <>
                <p className={styles.actionDesc}>
                  This quest reads your seal status for Week {quest.weekNumber}. Once that week is sealed on the home dashboard, you can claim the reflections here.
                </p>
                <div className={styles.callout} data-state={progressCount >= targetCount ? 'ready' : 'waiting'}>
                  <span className={styles.calloutDot} aria-hidden="true" />
                  <span>
                    {progressCount >= targetCount
                      ? `Week ${quest.weekNumber} is sealed. Claim is unlocked.`
                      : `Week ${quest.weekNumber} is not sealed yet. Finish the course on home first.`}
                  </span>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleCompleteReward}
                  disabled={!canClaimSealedWeek || isCompleting}
                >
                  {questIsComplete ? 'Quest cleared' : isCompleting ? 'Claiming...' : `Claim ${quest.points} reflections`}
                </button>
              </>
            )}

            {quest.rewardType === 'proof-required' && (
              <>
                <p className={styles.actionDesc}>
                  Each submission advances this quest by one entry. Stack {targetCount} entries to fully clear it.
                </p>
                <label className={styles.uploadZone}>
                  <UploadSimple size={26} weight="duotone" className={styles.uploadIcon} />
                  <span className={styles.uploadText}>
                    {selectedFile || 'Drop a file or click to choose'}
                  </span>
                  <span className={styles.uploadHint}>Images, video, PDF, or docs</span>
                  <input
                    type="file"
                    className={styles.uploadInput}
                    accept="image/*,video/*,.pdf,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setSelectedFile(file.name);
                    }}
                  />
                </label>
                <div className={styles.callout} data-state="info">
                  <span className={styles.calloutDot} aria-hidden="true" />
                  <span>Submissions are queued for review. Approved entries receive reflections automatically.</span>
                </div>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleCompleteReward}
                  disabled={isCompleting || questIsComplete}
                >
                  {questIsComplete
                    ? 'Quest cleared'
                    : isCompleting
                      ? 'Submitting...'
                      : `Submit entry (${progressCount}/${targetCount})`}
                </button>

                {usdcReward > 0 && usdcClaim && (
                  <div className={styles.usdcPanel}>
                    <div className={styles.usdcHeader}>
                      <span className={styles.usdcBadge}>${usdcClaim.reward} USDC bounty</span>
                      <span className={styles.usdcHeaderHint}>Academic Angels only</span>
                    </div>

                    {usdcClaim.loading ? (
                      <div className={styles.callout} data-state="info">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>Checking your USDC eligibility...</span>
                      </div>
                    ) : usdcClaim.status === 'paid' ? (
                      <div className={styles.callout} data-state="ready">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>
                          Paid. ${usdcClaim.reward} USDC was sent to your wallet.
                          {usdcClaim.txHash && (
                            <>
                              {' '}
                              <a
                                href={`https://basescan.org/tx/${usdcClaim.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.usdcTxLink}
                              >
                                View transaction
                                <ArrowSquareOut size={12} weight="bold" />
                              </a>
                            </>
                          )}
                        </span>
                      </div>
                    ) : usdcClaim.status === 'approved' ? (
                      <div className={styles.callout} data-state="info">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>Approved. Your USDC payout is on its way.</span>
                      </div>
                    ) : usdcClaim.status === 'pending' ? (
                      <div className={styles.callout} data-state="info">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>Submitted. Staff will review your work before Blue sends the payout.</span>
                      </div>
                    ) : usdcClaim.status === 'rejected' ? (
                      <div className={styles.callout} data-state="waiting">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>{usdcClaim.note || 'This USDC bounty was not approved.'}</span>
                      </div>
                    ) : usdcClaim.eligible ? (
                      <>
                        <p className={styles.actionDesc}>
                          Submit your work for review. Approved entries receive ${usdcClaim.reward} USDC in your wallet.
                        </p>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          onClick={handleRequestUsdc}
                          disabled={isSubmittingUsdc}
                        >
                          {isSubmittingUsdc ? 'Submitting...' : `Request $${usdcClaim.reward} USDC payout`}
                        </button>
                      </>
                    ) : (
                      <div className={styles.callout} data-state="waiting">
                        <span className={styles.calloutDot} aria-hidden="true" />
                        <span>Hold an Academic Angel NFT to unlock the ${usdcClaim.reward} USDC bounty.</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {quest.rewardType === 'no-proof' && (
              <>
                <p className={styles.actionDesc}>
                  Finish the task above on your own, then claim your reflections. This one uses self-attestation.
                </p>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={handleCompleteReward}
                  disabled={isCompleting || questIsComplete}
                >
                  {questIsComplete ? 'Quest cleared' : isCompleting ? 'Claiming...' : `Claim ${quest.points} reflections`}
                </button>
              </>
            )}

            {quest.rewardType === 'twitter-follow' && (
              <>
                <p className={styles.actionDesc}>
                  Two steps: link your X account, then follow @MentalWealthDAO. The drawer will auto-verify when you return.
                </p>

                <div className={styles.stepList}>
                  <div className={`${styles.stepItem} ${step1Completed ? styles.stepItemDone : ''}`}>
                    <span className={styles.stepCheck}>
                      {step1Completed ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} weight="bold" />}
                    </span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Connect your X account</span>
                      <span className={styles.stepDesc}>Link your X profile through Privy</span>
                    </div>
                    {!step1Completed && isConnected && (
                      <button type="button" className={styles.smallButton} onClick={handleConnectTwitter}>
                        Connect
                      </button>
                    )}
                  </div>

                  <div className={`${styles.stepItem} ${step2Completed ? styles.stepItemDone : ''}`}>
                    <span className={styles.stepCheck}>
                      {step2Completed ? <CheckCircle size={20} weight="fill" /> : <Circle size={20} weight="bold" />}
                    </span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Follow @MentalWealthDAO</span>
                      <span className={styles.stepDesc}>We verify the follow automatically</span>
                    </div>
                    {step1Completed && !step2Completed && (
                      <div className={styles.stepActions}>
                        <a
                          href="https://twitter.com/MentalWealthDAO"
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.smallButton}
                        >
                          Open
                          <ArrowSquareOut size={12} weight="bold" />
                        </a>
                        <button
                          type="button"
                          className={styles.smallButton}
                          onClick={handleCheckFollow}
                          disabled={isCheckingFollow}
                        >
                          {isCheckingFollow ? 'Checking...' : 'Verify'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {step1Completed && step2Completed && (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={handleCompleteReward}
                    disabled={isCompleting || questIsComplete}
                  >
                    {questIsComplete ? 'Quest cleared' : isCompleting ? 'Claiming...' : 'Claim reflections'}
                  </button>
                )}

                {!isConnected && (
                  <div className={styles.callout} data-state="waiting">
                    <span className={styles.calloutDot} aria-hidden="true" />
                    <span>Sign in to start this quest.</span>
                  </div>
                )}
              </>
            )}

            {quest.rewardType === 'follow-and-own' && (
              <>
                <p className={styles.actionDesc}>
                  Follow @daemonagent on Farcaster and verify ownership of an Academic Angel.
                </p>
                <div className={styles.stepList}>
                  <div className={styles.stepItem}>
                    <span className={styles.stepCheck}>
                      <Circle size={20} weight="bold" />
                    </span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Follow @daemonagent</span>
                      <span className={styles.stepDesc}>Farcaster account on Warpcast</span>
                    </div>
                  </div>
                  <div className={styles.stepItem}>
                    <span className={styles.stepCheck}>
                      <Circle size={20} weight="bold" />
                    </span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Own an Academic Angel</span>
                      <span className={styles.stepDesc}>Verified on Base</span>
                    </div>
                  </div>
                </div>
                <button type="button" className={styles.primaryButton} disabled>
                  Verification coming soon
                </button>
              </>
            )}
          </section>
        </div>
      </aside>

      <ConfettiCelebration trigger={showConfetti} />
      {showDiamondReward && (
        <DiamondReward
          amount={shardsAwarded}
          onComplete={() => {
            setShowDiamondReward(false);
            afterRewardRef.current?.();
            afterRewardRef.current = null;
          }}
        />
      )}
      <XConnectingModal isOpen={showConnectingModal} />
    </>
  );
};

export default QuestDrawer;
