'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useReadContract } from 'wagmi';
import Image from 'next/image';
import { Trophy, Sparkle, Plus, Lightning, Target, CaretDown, Check } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import QuestCard, { QuestCardKind } from '@/components/quest-card/QuestCard';
import QuestAuthorPanel from '@/components/quest-author-panel/QuestAuthorPanel';
import QuestDrawer, { DrawerQuest } from '@/components/quest-drawer/QuestDrawer';
import AngelMintSection from '@/components/angel-mint-section/AngelMintSection';
import MintModal from '@/components/mint-modal/MintModal';
import { useSound } from '@/hooks/useSound';
import { QUEST_DEFINITIONS, QuestType } from '@/lib/quest-definitions';
import styles from './page.module.css';

interface WeekStatus {
  weekNumber: number;
  isSealed: boolean;
}

interface PlayerProfile {
  username: string | null;
  avatarUrl: string | null;
  shardCount: number;
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

const SOUL_KEY_ADDRESS = '0x39f259B58A9aB02d42bC3DF5836bA7fc76a8880F' as const;
const BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

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
  const { ready, authenticated, getAccessToken, user: privyUser } = usePrivy();
  const walletAddress = useMemo(() => {
    const wallets = ((privyUser?.linkedAccounts ?? []) as any[]).filter((a) => a?.type === 'wallet');
    return wallets[0]?.address as `0x${string}` | undefined;
  }, [privyUser]);

  const { data: proTokenBalance } = useReadContract({
    address: SOUL_KEY_ADDRESS,
    abi: BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    query: { enabled: !!walletAddress },
  });
  const isPro = !!proTokenBalance && proTokenBalance > 0n;

  const [selectedQuest, setSelectedQuest] = useState<DrawerQuest | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [questCounts, setQuestCounts] = useState<Record<string, number>>({});
  const [customQuests, setCustomQuests] = useState<CustomQuest[]>([]);
  const [authoredQuests, setAuthoredQuests] = useState<CustomQuest[]>([]);
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile | null>(null);
  const [authorPanelOpen, setAuthorPanelOpen] = useState(false);
  const [filter, setFilter] = useState<QuestFilter>('all');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const { play } = useSound();

  const fetchWithAuth = useCallback(async (url: string) => {
    const token = await getAccessToken();
    const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
    return fetch(url, { credentials: 'include', cache: 'no-store', headers });
  }, [getAccessToken]);

  const refreshQuestData = useCallback(async () => {
    if (!ready || !authenticated) {
      setWeekStatuses([]);
      setQuestCounts({});
      setCustomQuests([]);
      setAuthoredQuests([]);
      return;
    }

    try {
      const [weeksRes, countsRes, meRes, visibleRes] = await Promise.all([
        fetchWithAuth('/api/ethereal-progress/all'),
        fetchWithAuth('/api/quests/progress'),
        fetchWithAuth('/api/me'),
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

      if (meRes.ok) {
        const meData = await meRes.json();
        if (meData.user) {
          setPlayerProfile({
            username: meData.user.username ?? null,
            avatarUrl: meData.user.avatarUrl ?? null,
            shardCount: meData.user.shardCount ?? 0,
          });
        }
      }

      if (visibleRes.ok) {
        const data = await visibleRes.json();
        setCustomQuests(data.quests ?? []);
      }
    } catch {
      setWeekStatuses([]);
      setQuestCounts({});
      setCustomQuests([]);
      setPlayerProfile(null);
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
  const totalShardsAvailable = useMemo(
    () => allQuests
      .filter((q) => (q.claimedCount ?? 0) < (q.targetCount ?? 1))
      .reduce((sum, q) => sum + q.points, 0),
    [allQuests],
  );

  const filterCount = (key: QuestFilter) =>
    key === 'all' ? totalQuestCount : countsByKind[key as QuestCardKind];

  const playerName = playerProfile?.username?.trim() || 'Player One';
  const playerInitial = playerName.charAt(0).toUpperCase();

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
            {/* ── Player banner ── */}
            <section className={styles.hero} aria-label="Player overview">
              <div className={styles.heroLeft}>
                <div className={styles.heroAvatar}>
                  {playerProfile?.avatarUrl ? (
                    <Image
                      src={playerProfile.avatarUrl}
                      alt={playerName}
                      width={48}
                      height={48}
                      className={styles.heroAvatarImg}
                    />
                  ) : (
                    <span className={styles.heroAvatarFallback}>{playerInitial}</span>
                  )}
                </div>
                <div className={styles.heroNameBlock}>
                  <span className={styles.heroEyebrow}>operative</span>
                  <h1 className={styles.heroName}>{playerName}</h1>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatLabel}>Shards</span>
                  <span className={styles.heroStatValueRow}>
                    <Image src="/icons/ui-shard.svg" alt="" width={15} height={15} />
                    <span className={styles.heroStatValue}>{playerProfile?.shardCount ?? 0}</span>
                  </span>
                </div>
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
                  <span className={styles.heroStatLabel}>On offer</span>
                  <span className={styles.heroStatValueRow}>
                    <Lightning size={14} weight="fill" className={styles.heroStatIconBolt} />
                    <span className={styles.heroStatValue}>{totalShardsAvailable}</span>
                  </span>
                </div>
              </div>
            </section>

            {/* ── Pro author rail ── */}
            {isPro && (
              <section className={styles.adminSection} aria-label="Quest authoring">
                <button
                  type="button"
                  className={styles.adminToggle}
                  onClick={() => setAuthorPanelOpen((v) => !v)}
                  aria-expanded={authorPanelOpen}
                >
                  <span className={styles.adminToggleIcon} aria-hidden="true">
                    <Sparkle size={14} weight="fill" />
                  </span>
                  <span className={styles.adminToggleLabel}>
                    {authorPanelOpen ? 'Hide quest forge' : 'Open quest forge'}
                  </span>
                  <span className={styles.adminToggleHint}>Member Key</span>
                  <span className={styles.adminToggleChevron} aria-hidden="true">
                    <Plus
                      size={14}
                      weight="bold"
                      style={{ transform: authorPanelOpen ? 'rotate(45deg)' : 'none', transition: 'transform 0.2s' }}
                    />
                  </span>
                </button>

                {authorPanelOpen && (
                  <QuestAuthorPanel
                    fetchWithAuth={fetchWithAuth}
                    authoredQuests={authoredQuests}
                    onCreated={handleQuestAuthored}
                    onDelete={handleDeleteAuthored}
                  />
                )}
              </section>
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

            {/* ── Flat quest list ── */}
            <div className={styles.questList}>
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
    </>
  );
}
