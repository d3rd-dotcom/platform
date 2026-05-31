'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Trophy, Sparkle, Coins, Check, Info } from '@phosphor-icons/react';
import BlueChatBubble from '@/components/blue-chat-bubble/BlueChatBubble';
import type { DrawerQuest } from '@/components/quest-drawer/QuestDrawer';
import type { QuestCardKind } from '@/components/quest-card/QuestCard';
import { useSound } from '@/hooks/useSound';
import styles from './QuestListPanel.module.css';

export interface UnifiedQuest extends DrawerQuest {
  kind: QuestCardKind;
}

export type QuestFilter = 'all' | QuestCardKind;

const FILTER_ORDER: QuestFilter[] = ['all', 'course', 'mission', 'submit', 'social', 'custom'];
const FILTER_LABEL: Record<QuestFilter, string> = {
  all: 'All',
  course: 'Course',
  mission: 'Mission',
  submit: 'Submit',
  social: 'Social',
  custom: 'Custom',
};

const KIND_COLOR: Record<QuestCardKind, string> = {
  course: '#5168ff',
  mission: '#4ea968',
  submit: '#ff9c51',
  social: '#a871f4',
  custom: '#ff648e',
};

const KIND_LABEL: Record<QuestCardKind, string> = {
  course: 'Course',
  mission: 'Mission',
  submit: 'Submit',
  social: 'Social',
  custom: 'Custom',
};

interface QuestListPanelProps {
  quests: UnifiedQuest[];
  selectedQuestId: string | null;
  filter: QuestFilter;
  onFilterChange: (f: QuestFilter) => void;
  onSelectQuest: (quest: UnifiedQuest) => void;
  completedCount: number;
  totalCount: number;
  usdcAvailable: number;
  isPro: boolean;
  onForge: () => void;
  onClaims: () => void;
}

const MSG_DEFAULT = 'Credits and rewards for completionists dedicated to self-improvement. Small steps make a difference.';
const MSG_USDC = '$1 USDC per quest, paid on-chain to your wallet. Academic Angels only — hold the NFT on Base to unlock.';

export default function QuestListPanel({
  quests,
  selectedQuestId,
  filter,
  onFilterChange,
  onSelectQuest,
  completedCount,
  totalCount,
  usdcAvailable,
  isPro,
  onForge,
  onClaims,
}: QuestListPanelProps) {
  const { play } = useSound();
  const [blueMessage, setBlueMessage] = useState(MSG_DEFAULT);
  const usdcInfoActive = blueMessage === MSG_USDC;

  const handleUsdcInfo = () => {
    play('click');
    setBlueMessage(usdcInfoActive ? MSG_DEFAULT : MSG_USDC);
  };

  const countsByKind = React.useMemo(() => {
    const acc: Record<QuestCardKind, number> = { course: 0, mission: 0, submit: 0, social: 0, custom: 0 };
    for (const q of quests) acc[q.kind] += 1;
    return acc;
  }, [quests]);

  const filteredQuests = React.useMemo(() => {
    if (filter === 'all') return quests;
    return quests.filter((q) => q.kind === filter);
  }, [quests, filter]);

  return (
    <div className={styles.panel}>
      <section className={styles.header}>
        <div className={styles.headerRow}>
          <span className={styles.eyebrow}>Quest board</span>
          <span className={styles.versionBadge}>
            <Image src="/icons/ui-shard.svg" alt="" width={9} height={9} />
            MWA
          </span>
        </div>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Cleared</span>
            <span className={styles.statValue}>
              <Trophy size={12} weight="fill" className={styles.statIcon} />
              {completedCount}
              <span className={styles.statMuted}>/{totalCount}</span>
            </span>
          </div>
          {usdcAvailable > 0 && (
            <div className={styles.stat}>
              <span className={styles.statLabelRow}>
                <span className={styles.statLabel}>USDC available</span>
                <button
                  type="button"
                  className={`${styles.infoBtn} ${usdcInfoActive ? styles.infoBtnActive : ''}`}
                  onClick={handleUsdcInfo}
                  aria-label="What are USDC bounties?"
                  title="What are USDC bounties?"
                >
                  <Info size={11} weight="fill" />
                </button>
              </span>
              <span className={styles.statValue}>
                <Image src="/icons/usdc.svg" alt="USDC" width={14} height={14} />
                ${usdcAvailable}
              </span>
            </div>
          )}
        </div>
      </section>

      <BlueChatBubble
        className={styles.blueBubble}
        message={blueMessage}
        variant="compact"
      />

      <div className={styles.filters} role="tablist">
        {FILTER_ORDER.map((key) => {
          const count = key === 'all' ? totalCount : countsByKind[key as QuestCardKind];
          if (key !== 'all' && count === 0) return null;
          const active = filter === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`${styles.filterPill} ${active ? styles.filterPillActive : ''}`}
              onClick={() => { play('click'); onFilterChange(key); }}
            >
              {FILTER_LABEL[key]}
            </button>
          );
        })}
      </div>

      <div className={styles.questList}>
        {filteredQuests.length === 0 ? (
          <div className={styles.empty}>No quests match this filter.</div>
        ) : (
          filteredQuests.map((quest) => {
            const completed = (quest.claimedCount ?? 0) >= (quest.targetCount ?? 1);
            const inProgress = !completed && (quest.progressCount ?? 0) > 0;
            const color = KIND_COLOR[quest.kind];
            const isSelected = quest.id === selectedQuestId;

            return (
              <button
                key={quest.id}
                type="button"
                className={`${styles.questItem} ${isSelected ? styles.questItemActive : ''} ${completed ? styles.questItemDone : ''}`}
                style={{ '--accent': color } as React.CSSProperties}
                onClick={() => { play('click'); onSelectQuest(quest); }}
                onMouseEnter={() => play('hover')}
              >
                <span className={styles.questAccent} aria-hidden="true" />
                <span className={styles.questInfo}>
                  <span className={styles.questTitle}>{quest.title}</span>
                  <span className={styles.questSub}>
                    {KIND_LABEL[quest.kind]}
                    {inProgress ? ' · in progress' : ''}
                  </span>
                </span>
                <span className={styles.questRight}>
                  {completed ? (
                    <span className={styles.questCheck}>
                      <Check size={11} weight="bold" />
                    </span>
                  ) : (quest.usdcReward ?? 0) > 0 ? (
                    <span className={styles.questBadge} style={{ '--bc': '#2775CA' } as React.CSSProperties}>
                      ${quest.usdcReward}
                    </span>
                  ) : (
                    <span className={styles.questBadge} style={{ '--bc': color } as React.CSSProperties}>
                      <Image src="/icons/ui-shard.svg" alt="" width={9} height={9} />
                      {quest.points}
                    </span>
                  )}
                </span>
              </button>
            );
          })
        )}
      </div>

      {isPro && (
        <div className={styles.vipRow}>
          <button
            type="button"
            className={styles.vipBtn}
            onClick={() => { play('click'); onForge(); }}
            onMouseEnter={() => play('hover')}
          >
            <Sparkle size={12} weight="fill" />
            Quest forge
          </button>
          <button
            type="button"
            className={styles.vipBtn}
            onClick={() => { play('click'); onClaims(); }}
            onMouseEnter={() => play('hover')}
          >
            <Coins size={12} weight="fill" />
            Claims
          </button>
        </div>
      )}
    </div>
  );
}
