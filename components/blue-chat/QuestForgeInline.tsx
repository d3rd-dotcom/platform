'use client';

import React, { useEffect, useMemo, useState } from 'react';
import styles from './BlueChat.module.css';
import { FORGE_LIMITS, type QuestForgeType, type RewardKind } from '@/lib/quest-forge';

export interface QuestForgeDraft {
  title: string;
  description: string;
  questType: QuestForgeType;
  rewardKind: RewardKind;
  rewardAmount: number;
  targetCount: number;
}

export interface QuestForgeRequest {
  title: string;
  description: string;
  questType: QuestForgeType;
  rewardKind: RewardKind;
  rewardAmount: number;
  targetCount: number;
  assigneeWallet?: string;
  expiresAt?: string;
}

interface QuestForgeInlineProps {
  isBusy: boolean;
  /** Blue's drafted fields. Re-applied whenever draftNonce changes. */
  draft: QuestForgeDraft | null;
  draftNonce: number;
  /** Creator's current credit balance, for the escrow affordability hint. */
  creditBalance: number | null;
  onSubmit: (request: QuestForgeRequest) => void;
  onClose: () => void;
}

const QuestForgeInline: React.FC<QuestForgeInlineProps> = ({
  isBusy,
  draft,
  draftNonce,
  creditBalance,
  onSubmit,
  onClose,
}) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questType, setQuestType] = useState<QuestForgeType>('no-proof');
  const [rewardKind, setRewardKind] = useState<RewardKind>('credits');
  const [rewardAmount, setRewardAmount] = useState<number>(50);
  const [targetCount, setTargetCount] = useState<number>(1);
  const [assigneeWallet, setAssigneeWallet] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Apply Blue's draft whenever she produces a fresh one.
  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setDescription(draft.description);
    setQuestType(draft.questType);
    setRewardKind(draft.rewardKind);
    setRewardAmount(draft.rewardAmount);
    setTargetCount(draft.targetCount);
    setError(null);
    setIsMinimized(false);
  }, [draft, draftNonce]);

  const escrowTotal = useMemo(() => {
    const total = rewardAmount * targetCount;
    return rewardKind === 'usdc' ? Math.round(total * 100) / 100 : Math.round(total);
  }, [rewardAmount, targetCount, rewardKind]);

  const switchRewardKind = (kind: RewardKind) => {
    if (kind === rewardKind) return;
    setRewardKind(kind);
    // Snap the amount into the new kind's sensible default range.
    setRewardAmount(kind === 'usdc' ? 1 : 50);
    setError(null);
  };

  const submit = () => {
    setError(null);
    if (!title.trim() || !description.trim()) {
      setError('Give the quest a title and a description.');
      return;
    }
    if (rewardKind === 'credits' && (rewardAmount < FORGE_LIMITS.creditsMin || rewardAmount > FORGE_LIMITS.creditsMax)) {
      setError(`Credit reward must be between ${FORGE_LIMITS.creditsMin} and ${FORGE_LIMITS.creditsMax}.`);
      return;
    }
    if (rewardKind === 'usdc' && (rewardAmount < FORGE_LIMITS.usdcMin || rewardAmount > FORGE_LIMITS.usdcMax)) {
      setError(`USDC reward must be between $${FORGE_LIMITS.usdcMin} and $${FORGE_LIMITS.usdcMax} per completion.`);
      return;
    }
    if (rewardKind === 'usdc' && escrowTotal > FORGE_LIMITS.usdcEscrowTotalMax) {
      setError(`Total USDC escrow ($${escrowTotal}) is over the $${FORGE_LIMITS.usdcEscrowTotalMax} limit.`);
      return;
    }
    if (assigneeWallet && !/^0x[a-fA-F0-9]{40}$/.test(assigneeWallet.trim())) {
      setError('Assignee wallet must be a valid 0x address.');
      return;
    }
    onSubmit({
      title: title.trim(),
      description: description.trim(),
      questType,
      rewardKind,
      rewardAmount,
      targetCount,
      assigneeWallet: assigneeWallet.trim() || undefined,
      expiresAt: expiresAt || undefined,
    });
  };

  const creditsShort =
    rewardKind === 'credits' && creditBalance != null && escrowTotal > creditBalance;

  if (isMinimized) {
    return (
      <div className={styles.autoDistributionMinimizedChip}>
        <span className={styles.autoDistributionTitle}>Quest forge</span>
        <button
          type="button"
          className={styles.autoDistributionMinimizeBtn}
          onClick={() => setIsMinimized(false)}
          aria-label="Expand quest forge"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.autoDistributionPanel}>
      <div className={styles.autoDistributionHeader}>
        <span className={styles.autoDistributionTitle}>Quest forge</span>
        <button
          type="button"
          className={styles.autoDistributionMinimizeBtn}
          onClick={() => setIsMinimized(true)}
          aria-label="Minimize quest forge"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
      <p className={styles.autoDistributionDesc}>
        Tell me the quest in a sentence and I&apos;ll fill this in — or edit it yourself. You fund the reward up front and I hold it until a completer is paid.
      </p>

      <div className={styles.autoDistributionSection}>
        <span className={styles.autoDistributionLabel}>Title</span>
        <input
          className={styles.questForgeInput}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Share your first reflection"
          maxLength={FORGE_LIMITS.titleMax}
          disabled={isBusy}
        />
      </div>

      <div className={styles.autoDistributionSection}>
        <span className={styles.autoDistributionLabel}>What to do</span>
        <textarea
          className={styles.autoDistributionTextarea}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Explain exactly what a completer should do."
          maxLength={FORGE_LIMITS.descMax}
          rows={3}
          disabled={isBusy}
        />
      </div>

      <div className={styles.autoDistributionSection}>
        <span className={styles.autoDistributionLabel}>Reward</span>
        <div className={styles.autoDistributionPills}>
          {([['credits', 'Credits'], ['usdc', 'USDC']] as Array<[RewardKind, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.autoDistributionPill} ${rewardKind === value ? styles.autoDistributionPillActive : ''}`}
              onClick={() => switchRewardKind(value)}
              disabled={isBusy}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.questForgeRow}>
        <div className={styles.autoDistributionSection}>
          <span className={styles.autoDistributionLabel}>
            {rewardKind === 'usdc' ? 'USDC each ($)' : 'Credits each'}
          </span>
          <input
            className={styles.questForgeInput}
            type="number"
            min={rewardKind === 'usdc' ? FORGE_LIMITS.usdcMin : FORGE_LIMITS.creditsMin}
            max={rewardKind === 'usdc' ? FORGE_LIMITS.usdcMax : FORGE_LIMITS.creditsMax}
            step={rewardKind === 'usdc' ? 0.25 : 1}
            value={rewardAmount}
            onChange={(e) => setRewardAmount(Number(e.target.value))}
            disabled={isBusy}
          />
        </div>
        <div className={styles.autoDistributionSection}>
          <span className={styles.autoDistributionLabel}>How many can complete</span>
          <input
            className={styles.questForgeInput}
            type="number"
            min={FORGE_LIMITS.targetMin}
            max={FORGE_LIMITS.targetMax}
            step={1}
            value={targetCount}
            onChange={(e) => setTargetCount(Math.max(1, Math.round(Number(e.target.value))))}
            disabled={isBusy}
          />
        </div>
      </div>

      <div className={styles.autoDistributionSection}>
        <span className={styles.autoDistributionLabel}>Completion</span>
        <div className={styles.autoDistributionPills}>
          {([['no-proof', 'No proof'], ['proof-required', 'Proof required']] as Array<[QuestForgeType, string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`${styles.autoDistributionPill} ${questType === value ? styles.autoDistributionPillActive : ''}`}
              onClick={() => setQuestType(value)}
              disabled={isBusy}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.questForgeRow}>
        <div className={styles.autoDistributionSection}>
          <span className={styles.autoDistributionLabel}>Assign to wallet (optional)</span>
          <input
            className={styles.questForgeInput}
            type="text"
            value={assigneeWallet}
            onChange={(e) => setAssigneeWallet(e.target.value)}
            placeholder="0x… — blank = everyone"
            disabled={isBusy}
          />
        </div>
        <div className={styles.autoDistributionSection}>
          <span className={styles.autoDistributionLabel}>Expires (optional)</span>
          <input
            className={styles.questForgeInput}
            type="datetime-local"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            disabled={isBusy}
          />
        </div>
      </div>

      <div className={styles.questForgeEscrowNote}>
        {rewardKind === 'usdc'
          ? `I'll hold $${escrowTotal} USDC in escrow — you send it from your wallet next.`
          : `I'll hold ${escrowTotal} credits in escrow${creditBalance != null ? ` (you have ${creditBalance.toLocaleString()})` : ''}.`}
      </div>

      {creditsShort && (
        <div className={styles.questForgeError}>
          Not enough credits — this quest needs {escrowTotal.toLocaleString()}.
        </div>
      )}
      {error && <div className={styles.questForgeError}>{error}</div>}

      <div className={styles.autoDistributionFooter}>
        <div className={styles.autoDistributionButtons}>
          <button type="button" className={styles.inlineFormCancel} onClick={onClose} disabled={isBusy}>
            Close
          </button>
          <button
            type="button"
            className={styles.inlineFormProceed}
            onClick={submit}
            disabled={isBusy || !title.trim() || !description.trim() || (creditsShort ?? false)}
          >
            {rewardKind === 'usdc' ? 'Fund & forge' : 'Forge quest'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuestForgeInline;
