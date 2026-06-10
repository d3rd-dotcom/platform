'use client';

import React from 'react';
import Image from 'next/image';
import { Check } from '@phosphor-icons/react';
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
}

function isQuestCleared(quest: UnifiedQuest): boolean {
  return (quest.claimedCount ?? 0) >= (quest.targetCount ?? 1);
}

export default function QuestListPanel({
  quests,
  selectedQuestId,
  filter,
  onFilterChange,
  onSelectQuest,
}: QuestListPanelProps) {
  const { play } = useSound();

  const tallies = React.useMemo(() => {
    const acc: Record<QuestFilter, { total: number; cleared: number }> = {
      all: { total: 0, cleared: 0 },
      course: { total: 0, cleared: 0 },
      mission: { total: 0, cleared: 0 },
      submit: { total: 0, cleared: 0 },
      social: { total: 0, cleared: 0 },
      custom: { total: 0, cleared: 0 },
    };
    for (const q of quests) {
      const cleared = isQuestCleared(q) ? 1 : 0;
      acc.all.total += 1;
      acc.all.cleared += cleared;
      acc[q.kind].total += 1;
      acc[q.kind].cleared += cleared;
    }
    return acc;
  }, [quests]);

  const filteredQuests = React.useMemo(() => {
    if (filter === 'all') return quests;
    return quests.filter((q) => q.kind === filter);
  }, [quests, filter]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.boardHeader}>
        <div className={styles.boardHeaderInner}>
          <span className={styles.boardNode} aria-hidden="true" />
          <span className={styles.boardTitle}>Quest Board</span>
          <span className={styles.boardNode} aria-hidden="true" />
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.toolbar}>
          <div className={styles.filters} role="tablist">
            {FILTER_ORDER.map((key) => {
              const tally = tallies[key];
              if (key !== 'all' && tally.total === 0) return null;
              const active = filter === key;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`${styles.filterTab} ${active ? styles.filterTabActive : ''}`}
                  onClick={() => { play('click'); onFilterChange(key); }}
                >
                  {FILTER_LABEL[key]}
                  <span className={styles.filterCount}>{tally.cleared}/{tally.total}</span>
                </button>
              );
            })}
          </div>
          <span className={styles.toolbarStat}>
            <Image src="/icons/money.svg" alt="" width={13} height={13} />
            {tallies.all.cleared}
            <span className={styles.toolbarStatMuted}>/{tallies.all.total} cleared</span>
          </span>
        </div>

        <div className={styles.list}>
          {filteredQuests.length === 0 ? (
            <div className={styles.empty}>No quests match this filter.</div>
          ) : (
            filteredQuests.map((quest) => {
              const targetCount = quest.targetCount ?? 1;
              const completed = isQuestCleared(quest);
              const inProgress = !completed && (quest.progressCount ?? 0) > 0;
              const color = KIND_COLOR[quest.kind];
              const isSelected = quest.id === selectedQuestId;
              const usdcReward = quest.usdcReward ?? 0;

              return (
                <button
                  key={quest.id}
                  type="button"
                  className={`${styles.card} ${isSelected ? styles.cardActive : ''} ${completed ? styles.cardDone : ''}`}
                  style={{ '--accent': color } as React.CSSProperties}
                  onClick={() => { play('click'); onSelectQuest(quest); }}
                  onMouseEnter={() => play('hover')}
                >
                  <span className={styles.artwork} data-kind={quest.kind} aria-hidden="true" />

                  <span className={styles.info}>
                    <span className={styles.metaRow}>
                      <span className={styles.kindTag}>
                        <span className={styles.kindDot} aria-hidden="true" />
                        {KIND_LABEL[quest.kind]}
                      </span>
                      {inProgress && <span className={styles.stateTag}>In progress</span>}
                      {quest.authorLabel && <span className={styles.byline}>{quest.authorLabel}</span>}
                    </span>
                    <span className={styles.title}>{quest.title}</span>
                    <span className={styles.desc}>{quest.desc}</span>
                  </span>

                  <span className={styles.rewards}>
                    {completed ? (
                      <>
                        <span className={styles.checkDone}>
                          <Check size={14} weight="bold" />
                        </span>
                        <span className={styles.clearedLabel}>Cleared</span>
                      </>
                    ) : (
                      <>
                        <span className={styles.rewardChip}>
                          <Image src="/icons/ui-diamond.svg" alt="" width={13} height={13} />
                          {quest.points}
                        </span>
                        {usdcReward > 0 && (
                          <span className={`${styles.rewardChip} ${styles.rewardChipUsdc}`}>
                            <Image src="/icons/usdc-logo.svg" alt="USDC" width={14} height={14} />
                            ${usdcReward}
                          </span>
                        )}
                        {targetCount > 1 && (
                          <span className={styles.progressLabel}>
                            {Math.min(quest.progressCount ?? 0, targetCount)}/{targetCount}
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
