'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Trophy, Target, CaretDown, Check, Sparkle, Coins } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import QuestCard, { QuestCardKind } from '@/components/quest-card/QuestCard';
import QuestAuthorPanel from '@/components/quest-author-panel/QuestAuthorPanel';
import QuestDrawer, { DrawerQuest } from '@/components/quest-drawer/QuestDrawer';
import AngelMintSection from '@/components/angel-mint-section/AngelMintSection';
import MintModal from '@/components/mint-modal/MintModal';
import QuestModal from '@/components/quest-modal/QuestModal';
import UsdcReviewPanel from '@/components/usdc-review-panel/UsdcReviewPanel';
import BlueChatBubble from '@/components/blue-chat-bubble/BlueChatBubble';

const QUESTS_BLUE_MESSAGE =
  'Mental Wealth Academy provides credits and rewards for completionists dedicated to self-improvement and contribution to the ecosystem. Small steps make a difference.';
import { useSound } from '@/hooks/useSound';
import { QUEST_DEFINITIONS, QuestType } from '@/lib/quest-definitions';
import styles from './page.module.css';

interface WeekStatus {
  weekNumber: number;
  isSealed: boolean;
}

interface CustomQuest {
  id: string;
  title: string;
  description: string;
  points: number;
  questType: 'no-proof' | 'proof-required';
  targetCount: number;
  creatorWallet: string;
  creatorHandle: string | null;
  assigneeWallet: string | null;
  expiresAt: string | null;
  createdAt: string;
  progressCount: number;
}

type QuestFilter = 'all' | QuestCardKind;

interface UnifiedQuest extends DrawerQuest {
  kind: QuestCardKind;
}

function questKindFromType(type: QuestType): QuestCardKind {
  switch (type) {
    case 'sealed-week':
      return 'course';
    case 'proof-required':
      return 'submit';
    case 'no-proof':
      return 'mission';
    case 'twitter-follow':
    case 'follow-and-own':
      return 'social';
    default:
      return 'custom';
  }
}

const FILTER_ORDER: QuestFilter[] = ['all', 'course', 'mission', 'submit', 'social', 'custom'];
const FILTER_LABEL: Record<QuestFilter, string> = {
  all: 'All quests',
  course: 'Course',
  mission: 'Mission',
  submit: 'Submit',
  social: 'Social',
  custom: 'Custom',
};

export default function QuestsPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  const [selectedQuest, setSelectedQuest] = useState<DrawerQuest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [questCounts, setQuestCounts] = useState<Record<string, number>>({});
  const [customQuests, setCustomQuests] = useState<CustomQuest[]>([]);
  const [authoredQuests, setAuthoredQuests] = useState<CustomQuest[]>([]);
  const [isPro, setIsPro] = useState(false);
  const [filter, setFilter] = useState<QuestFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const [forgeOpen, setForgeOpen] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const { play } = useSound();

  const fetchWithAuth = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAccessToken();
    const authHeader: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(url, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: { ...authHeader, ...(init?.headers ?? {}) },
    });
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setIsPro(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuth('/api/account/status');
        const data = res.ok ? await res.json().catch(() => null) : null;
        if (!cancelled) setIsPro(Boolean(data?.hasVipMembershipCard));
      } catch {
        if (!cancelled) setIsPro(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authenticated, fetchWithAuth, ready]);

  const refreshQuestData = useCallback(async () => {
    if (!ready || !authenticated) {
      setWeekStatuses([]);
      setQuestCounts({});
      setCustomQuests([]);
      return;
    }

    try {
      const [weeksRes, countsRes, visibleRes] = await Promise.all([
        fetchWithAuth('/api/ethereal-progress/all'),
        fetchWithAuth('/api/quests/progress'),
        fetchWithAuth('/api/admin/quests/visible'),
      ]);

      if (weeksRes.ok) {
        const weekData = await weeksRes.json();
        setWeekStatuses(weekData.weeks ?? []);
      }

      if (countsRes.ok) {
        const countData = await countsRes.json();
        setQuestCounts(countData.counts ?? {});
      }

      if (visibleRes.ok) {
        const data = await visibleRes.json();
        setCustomQuests(data.quests ?? []);
      }
    } catch {
      setWeekStatuses([]);
      setQuestCounts({});
      setCustomQuests([]);
    }
  }, [ready, authenticated, fetchWithAuth]);

  const refreshAuthoredQuests = useCallback(async () => {
    if (!ready || !authenticated || !isPro) {
      setAuthoredQuests([]);
      return;
    }
    try {
      const res = await fetchWithAuth('/api/admin/quests?mine=true');
      if (res.ok) {
        const data = await res.json();
        setAuthoredQuests(data.quests ?? []);
      }
    } catch {
      setAuthoredQuests([]);
    }
  }, [ready, authenticated, isPro, fetchWithAuth]);

  useEffect(() => {
    refreshQuestData();
  }, [refreshQuestData]);

  useEffect(() => {
    refreshAuthoredQuests();
  }, [refreshAuthoredQuests]);

  useEffect(() => {
    const handler = () => {
      refreshQuestData();
      refreshAuthoredQuests();
    };
    window.addEventListener('userLoaded', handler);
    window.addEventListener('userLoggedIn', handler);
    window.addEventListener('shardsUpdated', handler);
    return () => {
      window.removeEventListener('userLoaded', handler);
      window.removeEventListener('userLoggedIn', handler);
      window.removeEventListener('shardsUpdated', handler);
    };
  }, [refreshQuestData, refreshAuthoredQuests]);

  // Close the filter menu on outside click
  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [filterOpen]);

  const allQuests = useMemo<UnifiedQuest[]>(() => {
    const builtIn: UnifiedQuest[] = QUEST_DEFINITIONS.map((quest) => {
      const claimedCount = Math.min(questCounts[quest.key] ?? 0, quest.targetCount);
      const progressCount = quest.questType === 'sealed-week'
        ? (weekStatuses.find((week) => week.weekNumber === quest.weekNumber)?.isSealed ? 1 : 0)
        : claimedCount;

      return {
        id: quest.key,
        title: quest.title,
        points: quest.points,
        desc: quest.desc,
        rewardType: quest.questType,
        targetCount: quest.targetCount,
        progressCount,
        claimedCount,
        weekNumber: quest.weekNumber,
        icon: quest.icon,
        usdcReward: quest.usdcReward,
        kind: questKindFromType(quest.questType),
      };
    });

    const custom: UnifiedQuest[] = customQuests.map((q) => {
      const handleLabel = q.creatorHandle
        ? `By @${q.creatorHandle}`
        : q.creatorWallet
          ? `By ${q.creatorWallet.slice(0, 6)}…${q.creatorWallet.slice(-4)}`
          : undefined;
      return {
        id: q.id,
        title: q.title,
        points: q.points,
        desc: q.description,
        rewardType: q.questType,
        targetCount: q.targetCount,
        progressCount: q.progressCount,
        claimedCount: q.progressCount,
        kind: 'custom',
        authorLabel: handleLabel,
      };
    });

    return [...builtIn, ...custom];
  }, [customQuests, questCounts, weekStatuses]);

  const countsByKind = useMemo(() => {
    const acc: Record<QuestCardKind, number> = { course: 0, mission: 0, submit: 0, social: 0, custom: 0 };
    for (const quest of allQuests) acc[quest.kind] += 1;
    return acc;
  }, [allQuests]);

  const filteredQuests = useMemo(() => {
    if (filter === 'all') return allQuests;
    return allQuests.filter((q) => q.kind === filter);
  }, [allQuests, filter]);

  const totalQuestCount = allQuests.length;
  const completedQuestCount = useMemo(
    () => allQuests.filter((q) => (q.claimedCount ?? 0) >= (q.targetCount ?? 1)).length,
    [allQuests],
  );
  const usdcAvailable = useMemo(
    () => allQuests
      .filter((q) => (q.usdcReward ?? 0) > 0 && (q.claimedCount ?? 0) < (q.targetCount ?? 1))
      .reduce((sum, q) => sum + (q.usdcReward ?? 0), 0),
    [allQuests],
  );

  const filterCount = (key: QuestFilter) =>
    key === 'all' ? totalQuestCount : countsByKind[key as QuestCardKind];

  const handleAccept = (quest: UnifiedQuest) => {
    play('click');
    setSelectedQuest(quest);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = useCallback(() => {
    setIsDrawerOpen(false);
    setTimeout(() => setSelectedQuest(null), 320);
  }, []);

  const handleQuestAuthored = useCallback(() => {
    refreshAuthoredQuests();
    refreshQuestData();
  }, [refreshAuthoredQuests, refreshQuestData]);

  const handleDeleteAuthored = useCallback(async (id: string) => {
    if (!window.confirm('Archive this quest? It will stop appearing for users.')) return;
    const token = await getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`/api/admin/quests/${id}`, {
      method: 'DELETE',
      credentials: 'include',
      cache: 'no-store',
      headers,
    });
    if (res.ok) {
      handleQuestAuthored();
    }
  }, [getAccessToken, handleQuestAuthored]);

  return (
    <>
      <div className={styles.pageLayout}>
        <SideNavigation />
        <main className={styles.page}>
          <div className={styles.content}>
            <BlueChatBubble
              className={styles.questsBlueBubble}
              message={QUESTS_BLUE_MESSAGE}
              variant="featured"
              stackOnMobile
            />

            {/* ── Player stats ── */}
            <section className={styles.heroStats} aria-label="Player stats">
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>Cleared</span>
                <span className={styles.heroStatValueRow}>
                  <Trophy size={14} weight="fill" className={styles.heroStatIcon} />
                  <span className={styles.heroStatValue}>
                    {completedQuestCount}
                    <span className={styles.heroStatMuted}>/{totalQuestCount}</span>
                  </span>
                </span>
              </div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatLabel}>USDC</span>
                <span className={styles.heroStatValueRow}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="11" fill="#2775CA" />
                    <text x="12" y="16.5" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">$</text>
                  </svg>
                  <span className={styles.heroStatValue}>${usdcAvailable}</span>
                </span>
              </div>
            </section>

            {/* ── Member actions (VIP) ── */}
            {isPro && (
              <div className={styles.memberActions} aria-label="Member actions">
                <button
                  type="button"
                  className={styles.memberAction}
                  onClick={() => { play('click'); setForgeOpen(true); }}
                  onMouseEnter={() => play('hover')}
                >
                  <span className={styles.memberActionIcon} aria-hidden="true">
                    <Sparkle size={14} weight="fill" />
                  </span>
                  <span className={styles.memberActionLabel}>Quest forge</span>
                </button>
                <button
                  type="button"
                  className={styles.memberAction}
                  onClick={() => { play('click'); setClaimOpen(true); }}
                  onMouseEnter={() => play('hover')}
                >
                  <span className={styles.memberActionIcon} aria-hidden="true">
                    <Coins size={14} weight="fill" />
                  </span>
                  <span className={styles.memberActionLabel}>Claims</span>
                </button>
              </div>
            )}

            {/* ── Heading + compact filter ── */}
            <div className={styles.boardHeader}>
              <h2 className={styles.boardHeading}>Quests</h2>

              <div className={styles.filterWrap} ref={filterRef}>
                <button
                  type="button"
                  className={styles.filterTrigger}
                  onClick={() => { play('click'); setFilterOpen((v) => !v); }}
                  aria-haspopup="listbox"
                  aria-expanded={filterOpen}
                >
                  <span className={styles.filterDot} data-kind={filter} aria-hidden="true" />
                  <span className={styles.filterTriggerLabel}>{FILTER_LABEL[filter]}</span>
                  <span className={styles.filterTriggerCount}>{filterCount(filter)}</span>
                  <CaretDown
                    size={13}
                    weight="bold"
                    className={`${styles.filterCaret} ${filterOpen ? styles.filterCaretOpen : ''}`}
                  />
                </button>

                {filterOpen && (
                  <div className={styles.filterMenu} role="listbox">
                    {FILTER_ORDER.map((key) => {
                      const count = filterCount(key);
                      if (key !== 'all' && count === 0) return null;
                      const active = filter === key;
                      return (
                        <button
                          type="button"
                          key={key}
                          role="option"
                          aria-selected={active}
                          className={`${styles.filterOption} ${active ? styles.filterOptionActive : ''}`}
                          onClick={() => { play('click'); setFilter(key); setFilterOpen(false); }}
                        >
                          <span className={styles.filterDot} data-kind={key} aria-hidden="true" />
                          <span className={styles.filterOptionLabel}>{FILTER_LABEL[key]}</span>
                          <span className={styles.filterOptionCount}>{count}</span>
                          {active && <Check size={13} weight="bold" className={styles.filterOptionCheck} />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Two-column quest grid ── */}
            <div className={styles.questGrid}>
              {filteredQuests.length === 0 ? (
                <div className={styles.emptyState}>
                  <Target size={28} weight="duotone" />
                  <p>No quests match this filter yet.</p>
                </div>
              ) : (
                filteredQuests.map((quest) => (
                  <div key={quest.id} onMouseEnter={() => play('hover')}>
                    <QuestCard
                      title={quest.title}
                      description={quest.desc}
                      progressCurrent={quest.progressCount ?? 0}
                      progressTotal={quest.targetCount ?? 1}
                      points={quest.points}
                      kind={quest.kind}
                      usdcReward={quest.usdcReward}
                      angelGated={(quest.usdcReward ?? 0) > 0}
                      onOpen={() => handleAccept(quest)}
                    />
                  </div>
                ))
              )}
            </div>

            <div className={styles.boardFooter}>
              <AngelMintSection onOpenMintModal={() => setShowMintModal(true)} />
            </div>
          </div>
        </main>
      </div>

      <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)} />
      <QuestDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        quest={selectedQuest}
      />

      <QuestModal isOpen={forgeOpen} onClose={() => setForgeOpen(false)} title="Quest forge">
        <QuestAuthorPanel
          fetchWithAuth={fetchWithAuth}
          authoredQuests={authoredQuests}
          onCreated={handleQuestAuthored}
          onDelete={handleDeleteAuthored}
        />
      </QuestModal>

      <QuestModal isOpen={claimOpen} onClose={() => setClaimOpen(false)} title="USDC payouts to review">
        <UsdcReviewPanel fetchWithAuth={fetchWithAuth} />
      </QuestModal>
    </>
  );
}
