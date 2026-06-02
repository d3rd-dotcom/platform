'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount } from 'wagmi';
import { Target, CheckCircle, Circle, UploadSimple, ArrowSquareOut } from '@phosphor-icons/react';
import { ConfettiCelebration } from '../quests/ConfettiCelebration';
import { ShardAnimation } from '../quests/ShardAnimation';
import { XConnectingModal } from '../x-connecting/XConnectingModal';
import type { DrawerQuest } from '@/components/quest-drawer/QuestDrawer';
import type { QuestType } from '@/lib/quest-definitions';
import styles from './QuestDetailPanel.module.css';

const KIND_META: Record<QuestType, { label: string; tone: string }> = {
  'sealed-week': { label: 'Course', tone: 'course' },
  'proof-required': { label: 'Submit', tone: 'submit' },
  'no-proof': { label: 'Mission', tone: 'mission' },
  'twitter-follow': { label: 'Social', tone: 'social' },
  'follow-and-own': { label: 'Social', tone: 'social' },
};

type UsdcClaimStatus = 'pending' | 'approved' | 'paid' | 'rejected';

interface UsdcClaimState {
  loading: boolean;
  reward: number;
  eligible: boolean;
  status: UsdcClaimStatus | null;
  txHash: string | null;
  note: string | null;
}

interface QuestDetailPanelProps {
  quest: DrawerQuest | null;
  onDeselect: () => void;
}

export default function QuestDetailPanel({ quest, onDeselect }: QuestDetailPanelProps) {
  const { getAccessToken } = usePrivy();
  const { address, isConnected } = useAccount();
  const [step1Completed, setStep1Completed] = useState(false);
  const [step2Completed, setStep2Completed] = useState(false);
  const [isCheckingFollow, setIsCheckingFollow] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showShardAnimation, setShowShardAnimation] = useState(false);
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

  useEffect(() => {
    if (!quest || !usdcReward) {
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

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quest?.id, usdcReward]);

  useEffect(() => {
    if (!quest) {
      setSelectedFile(null);
      setStep1Completed(false);
      setStep2Completed(false);
    }
  }, [quest?.id]);

  useEffect(() => {
    if (!quest || quest.rewardType !== 'twitter-follow' || !isConnected) {
      setStep1Completed(false);
      setStep2Completed(false);
      return;
    }

    const checkXAccountAndFollow = async (autoCheckFollow = false) => {
      if (!isConnected || !address) { setStep1Completed(false); return; }

      try {
        const response = await fetch('/api/x-auth/status', { cache: 'no-store', credentials: 'include' });
        if (response.status === 401) { setStep1Completed(false); return; }
        const data = await response.json();
        const connected = data.connected === true;
        setStep1Completed(connected);

        if (connected && autoCheckFollow && !step2Completed) {
          const followResponse = await fetch('/api/x-auth/check-follow', { method: 'POST', cache: 'no-store', credentials: 'include' });
          const followData = await followResponse.json();

          if (followData.isFollowing) {
            setStep2Completed(true);
            try {
              const completeResponse = await fetch('/api/quests/auto-complete-twitter-quest', { method: 'POST', cache: 'no-store', credentials: 'include' });
              const completeData = await completeResponse.json();
              if (completeData.ok && completeData.shardsAwarded > 0) {
                setShardsAwarded(completeData.shardsAwarded);
                setShowConfetti(true);
                setShowShardAnimation(true);
                window.dispatchEvent(new Event('shardsUpdated'));
                setTimeout(() => { setShowConfetti(false); setShowShardAnimation(false); }, 5000);
              }
            } catch (error) { console.error('Failed to auto-complete reward:', error); }
          }
        }
      } catch (error) {
        console.error('Failed to check X account:', error);
        setStep1Completed(false);
      }
    };

    const params = new URLSearchParams(window.location.search);
    checkXAccountAndFollow(params.get('auto_check') === 'true');

    const handleFocus = () => checkXAccountAndFollow(true);
    const handleXAccountUpdate = () => checkXAccountAndFollow(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('xAccountUpdated', handleXAccountUpdate);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('xAccountUpdated', handleXAccountUpdate);
    };
  }, [quest?.id, isConnected, address, step2Completed]);

  const handleConnectTwitter = async () => {
    try {
      setShowConnectingModal(true);
      const response = await fetch('/api/x-auth/initiate', { credentials: 'include' });
      if (response.status === 401) { setShowConnectingModal(false); alert('Please sign in to connect your X account.'); return; }
      if (!response.ok) { setShowConnectingModal(false); return; }
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
      const response = await fetch('/api/x-auth/check-follow', { method: 'POST', cache: 'no-store', credentials: 'include' });
      const data = await response.json();
      if (data.isFollowing || data.requiresManualVerification) {
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
      const response = await fetch('/api/quests/complete', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ questId: quest.id, shards: quest.points }),
      });
      const data = await response.json();
      if (data.ok) {
        setShardsAwarded(quest.points);
        setShowConfetti(true);
        setShowShardAnimation(true);
        window.dispatchEvent(new Event('shardsUpdated'));
        setTimeout(() => {
          onDeselect();
          setTimeout(() => {
            setShowConfetti(false);
            setShowShardAnimation(false);
            setShardsAwarded(0);
            setSelectedFile(null);
          }, 2000);
        }, 5000);
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

  if (!quest) {
    return (
      <div className={styles.wrapper}>
        <div className={styles.boardHeader}>
          <div className={styles.boardHeaderInner}>
            <span className={styles.boardNode} aria-hidden="true" />
            <span className={styles.boardTitle}>Quest Board</span>
            <span className={styles.boardNode} aria-hidden="true" />
          </div>
        </div>
        <div className={styles.idle}>
          <div className={styles.idleInner}>
            <Target size={36} weight="duotone" className={styles.idleIcon} />
            <p className={styles.idleTitle}>Select a quest</p>
            <p className={styles.idleDesc}>Choose any quest from the list to see details and claim your rewards.</p>
          </div>
          <ConfettiCelebration trigger={false} />
        </div>
      </div>
    );
  }

  const kindMeta = KIND_META[quest.rewardType] ?? KIND_META['no-proof'];
  const targetCount = quest.targetCount ?? 1;
  const progressCount = Math.min(quest.progressCount ?? 0, targetCount);
  const claimedCount = quest.claimedCount ?? 0;
  const questIsComplete = claimedCount >= targetCount;
  const canClaimSealedWeek = quest.rewardType === 'sealed-week' && progressCount >= targetCount && !questIsComplete;

  // The status / eligibility line ("grey stuff") sits directly under the quest
  // description — it's the most relevant "what's next / what's blocking me" note.
  const statusCallout = (() => {
    if (quest.rewardType === 'sealed-week') {
      const sealed = progressCount >= targetCount;
      return (
        <div className={styles.callout} data-state={sealed ? 'ready' : 'waiting'}>
          <span className={styles.calloutDot} aria-hidden="true" />
          <span>
            {sealed
              ? `Week ${quest.weekNumber} is sealed — your credits are ready to claim.`
              : `Week ${quest.weekNumber} is not sealed yet. Finish that week on your home dashboard, then come back to claim.`}
          </span>
        </div>
      );
    }
    if (quest.rewardType === 'twitter-follow' && !isConnected) {
      return (
        <div className={styles.callout} data-state="waiting">
          <span className={styles.calloutDot} aria-hidden="true" />
          <span>Sign in to start this quest.</span>
        </div>
      );
    }
    if (quest.rewardType === 'proof-required' && usdcReward > 0 && usdcClaim) {
      if (usdcClaim.loading) {
        return (
          <div className={styles.callout} data-state="info">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>Checking your USDC eligibility...</span>
          </div>
        );
      }
      if (usdcClaim.status === 'paid') {
        return (
          <div className={styles.callout} data-state="ready">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>
              Paid. ${usdcClaim.reward} USDC was sent to your wallet.
              {usdcClaim.txHash && (
                <> <a href={`https://basescan.org/tx/${usdcClaim.txHash}`} target="_blank" rel="noopener noreferrer" className={styles.usdcTxLink}>
                  View transaction <ArrowSquareOut size={12} weight="bold" />
                </a></>
              )}
            </span>
          </div>
        );
      }
      if (usdcClaim.status === 'approved') {
        return (
          <div className={styles.callout} data-state="info">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>Approved. Your USDC payout is on its way.</span>
          </div>
        );
      }
      if (usdcClaim.status === 'pending') {
        return (
          <div className={styles.callout} data-state="info">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>Submitted. A staff member will review your work and release the USDC.</span>
          </div>
        );
      }
      if (usdcClaim.status === 'rejected') {
        return (
          <div className={styles.callout} data-state="waiting">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>{usdcClaim.note || 'This USDC bounty was not approved.'}</span>
          </div>
        );
      }
      if (!usdcClaim.eligible) {
        return (
          <div className={styles.callout} data-state="waiting">
            <span className={styles.calloutDot} aria-hidden="true" />
            <span>Hold an Academic Angel NFT to unlock the ${usdcClaim.reward} USDC bounty.</span>
          </div>
        );
      }
    }
    return null;
  })();

  return (
    <div className={styles.wrapper}>
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderInner}>
          <span className={styles.boardNode} aria-hidden="true" />
          <span className={styles.boardTitle}>Quest Board</span>
          <span className={styles.boardNode} aria-hidden="true" />
        </div>
      </div>
      <div className={styles.panel} data-tone={kindMeta.tone}>
      <div className={styles.scrollArea}>
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>{quest.title}</h1>
          {quest.authorLabel && <span className={styles.byline}>{quest.authorLabel}</span>}
          <p className={styles.heroDesc}>{quest.desc}</p>
          {statusCallout}
        </section>

        {quest.rewardType !== 'sealed-week' && (
          <section className={styles.action}>
            {quest.rewardType === 'proof-required' && (
              <>
                <p className={styles.actionDesc}>
                  {targetCount === 1
                    ? 'Share your entry whenever you are ready — a staff member will read it, and approval clears the quest. Take your time; there is no rush.'
                    : `Every entry you share moves you one step closer — submit all ${targetCount} to fully clear it. Take your time; there is no rush.`}
                </p>
                <label className={styles.uploadZone}>
                  <UploadSimple size={26} weight="duotone" className={styles.uploadIcon} />
                  <span className={styles.uploadText}>{selectedFile || 'Drop a file or click to choose'}</span>
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
                  <span>Submissions are queued for review. Approved entries receive credits automatically.</span>
                </div>
                {usdcReward > 0 && usdcClaim && !usdcClaim.loading && !usdcClaim.status && usdcClaim.eligible && (
                  <>
                    <p className={styles.actionDesc}>
                      Once your work is in, request your payout and a staff member will release ${usdcClaim.reward} USDC straight to your wallet.
                    </p>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={handleRequestUsdc}
                      disabled={isSubmittingUsdc}
                    >
                      {isSubmittingUsdc ? 'Submitting...' : `Request $${usdcClaim.reward} USDC payout`}
                    </button>
                  </>
                )}
              </>
            )}

            {quest.rewardType === 'no-proof' && (
              <p className={styles.actionDesc}>
                Finish the task above on your own, then claim your credits. This one uses self-attestation.
              </p>
            )}

            {quest.rewardType === 'twitter-follow' && (
              <>
                <p className={styles.actionDesc}>
                  Two steps: link your X account, then follow @MentalWealthDAO. The panel will auto-verify when you return.
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
                      <button type="button" className={styles.smallButton} onClick={handleConnectTwitter}>Connect</button>
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
                        <a href="https://twitter.com/MentalWealthDAO" target="_blank" rel="noopener noreferrer" className={styles.smallButton}>
                          Open <ArrowSquareOut size={12} weight="bold" />
                        </a>
                        <button type="button" className={styles.smallButton} onClick={handleCheckFollow} disabled={isCheckingFollow}>
                          {isCheckingFollow ? 'Checking...' : 'Verify'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {quest.rewardType === 'follow-and-own' && (
              <>
                <p className={styles.actionDesc}>
                  Follow @daemonagent on Farcaster and verify ownership of an Academic Angel.
                </p>
                <div className={styles.stepList}>
                  <div className={styles.stepItem}>
                    <span className={styles.stepCheck}><Circle size={20} weight="bold" /></span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Follow @daemonagent</span>
                      <span className={styles.stepDesc}>Farcaster account on Warpcast</span>
                    </div>
                  </div>
                  <div className={styles.stepItem}>
                    <span className={styles.stepCheck}><Circle size={20} weight="bold" /></span>
                    <div className={styles.stepContent}>
                      <span className={styles.stepTitle}>Own an Academic Angel</span>
                      <span className={styles.stepDesc}>Verified on Base</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </section>
        )}

        <section className={styles.rewards}>
          <span className={styles.rewardsLabel}>Rewards</span>
          <ul className={styles.rewardsList}>
            <li className={styles.rewardItem}>
              <Image src="/icons/ui-shard.svg" alt="" width={18} height={18} />
              <span className={styles.rewardItemValue}>{quest.points}</span>
              <span className={styles.rewardItemName}>Credits</span>
            </li>
            {usdcReward > 0 && (
              <li className={styles.rewardItem}>
                <Image src="/icons/usdc-logo.svg" alt="" width={18} height={18} />
                <span className={styles.rewardItemValue}>${usdcReward}</span>
                <span className={styles.rewardItemName}>USDC bounty</span>
                <span className={styles.rewardItemNote}>Academic Angels only</span>
              </li>
            )}
          </ul>
        </section>
      </div>

      <div className={styles.footer}>
        {quest.rewardType === 'sealed-week' && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleCompleteReward}
            disabled={!canClaimSealedWeek || isCompleting}
          >
            {questIsComplete ? 'Quest cleared' : isCompleting ? 'Claiming...' : `Claim ${quest.points} credits`}
          </button>
        )}
        {quest.rewardType === 'proof-required' && (
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
                : targetCount === 1
                  ? 'Submit entry'
                  : `Submit entry (${progressCount}/${targetCount})`}
          </button>
        )}
        {quest.rewardType === 'no-proof' && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleCompleteReward}
            disabled={isCompleting || questIsComplete}
          >
            {questIsComplete ? 'Quest cleared' : isCompleting ? 'Claiming...' : `Claim ${quest.points} credits`}
          </button>
        )}
        {quest.rewardType === 'twitter-follow' && (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleCompleteReward}
            disabled={isCompleting || questIsComplete || !step1Completed || !step2Completed}
          >
            {questIsComplete
              ? 'Quest cleared'
              : isCompleting
                ? 'Claiming...'
                : step1Completed && step2Completed
                  ? 'Claim credits'
                  : 'Complete the steps above'}
          </button>
        )}
        {quest.rewardType === 'follow-and-own' && (
          <button type="button" className={styles.primaryButton} disabled>Verification coming soon</button>
        )}
      </div>

      <ConfettiCelebration trigger={showConfetti} />
      {showShardAnimation && (
        <ShardAnimation shards={shardsAwarded} onComplete={() => setShowShardAnimation(false)} />
      )}
      <XConnectingModal isOpen={showConnectingModal} />
      </div>
    </div>
  );
}
