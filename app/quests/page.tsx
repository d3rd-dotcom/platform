'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useReadContract } from 'wagmi';
import Image from 'next/image';
import { Trophy, Sparkle, Plus, Lightning, Target, ChartLineUp } from '@phosphor-icons/react';
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
  badge?: string;
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
  all: 'All',
  course: 'Course',
  mission: 'Mission',
  submit: 'Submit',
  social: 'Social',
  custom: 'Custom',
};

const KIND_SECTION_TITLE: Record<QuestCardKind, string> = {
  course: 'Course milestones',
  mission: 'Self-report missions',
  submit: 'Proof submissions',
  social: 'Social signals',
  custom: 'Community quests',
};

const KIND_SECTION_BLURB: Record<QuestCardKind, string> = {
  course: 'Seal weekly lessons on the home dashboard, then claim shards here.',
  mission: 'Trust-based quests. Mark them as done when finished.',
  submit: 'Submit proof of work for community review.',
  social: 'Quick wins by connecting external accounts.',
  custom: 'Authored by Soul Key holders for the community.',
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
  const [countdown, setCountdown] = useState('--:--:--');
  const [seasonWeek, setSeasonWeek] = useState<number | null>(null);
  const [authorPanelOpen, setAuthorPanelOpen] = useState(false);
  const [filter, setFilter] = useState<QuestFilter>('all');
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

  useEffect(() => {
    const seasonStart = new Date(
      process.env.NEXT_PUBLIC_SEASON_START_DATE || '2026-03-02T00:00:00Z'
    ).getTime();
    const weekMs = 7 * 24 * 60 * 60 * 1000;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - seasonStart;
      if (elapsed < 0) {
        const remaining = Math.abs(elapsed);
        const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
        const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / 3_600_000);
        const minutes = Math.floor((remaining % 3_600_000) / 60_000);
        setCountdown(`${days}D ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`);
        setSeasonWeek(0);
        return;
      }
      const weekIndex = Math.floor(elapsed / weekMs);
      const nextBoundary = seasonStart + (weekIndex + 1) * weekMs;
      const remaining = Math.max(0, nextBoundary - now);
      const hours = Math.floor(remaining / 3_600_000);
      const minutes = Math.floor((remaining % 3_600_000) / 60_000);
      const seconds = Math.floor((remaining % 60_000) / 1000);
      setCountdown(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
      setSeasonWeek(weekIndex + 1);
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, []);

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
        badge: quest.weekNumber ? `Week ${quest.weekNumber}` : undefined,
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
        badge: handleLabel,
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

  const groupedQuests = useMemo(() => {
    const groups: Record<QuestCardKind, UnifiedQuest[]> = {
      course: [],
      mission: [],
      submit: [],
      social: [],
      custom: [],
    };
    for (const quest of filteredQuests) groups[quest.kind].push(quest);
    return groups;
  }, [filteredQuests]);

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

  const visibleSections = (Object.keys(groupedQuests) as QuestCardKind[]).filter(
    (kind) => groupedQuests[kind].length > 0,
  );

  return (
    <>
      <div className={styles.pageLayout}>
        <SideNavigation />
        <main className={styles.page}>
          {/* ── Terminal-style status bar ── */}
          <div className={styles.statusBar}>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>season</span>
              <span className={styles.statusHighlight}>
                {seasonWeek === null ? '--' : seasonWeek === 0 ? 'PRE-LAUNCH' : `WEEK ${seasonWeek}`}
              </span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>next reset</span>
              <span className={styles.statusTimer} aria-live="polite">{countdown}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>shards on table</span>
              <span className={styles.statusValue}>{totalShardsAvailable}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>cleared</span>
              <span className={styles.statusValue}>{completedQuestCount}/{totalQuestCount}</span>
            </div>
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>tier</span>
              <span className={styles.statusValue}>{isPro ? 'SOUL KEY' : 'ACADEMIC'}</span>
            </div>
          </div>

          <div className={styles.content}>
            {/* ── Player banner ── */}
            <section className={styles.hero} aria-label="Player overview">
              <div className={styles.heroLeft}>
                <div className={styles.heroAvatar}>
                  {playerProfile?.avatarUrl ? (
                    <Image
                      src={playerProfile.avatarUrl}
                      alt={playerName}
                      width={56}
                      height={56}
                      className={styles.heroAvatarImg}
                    />
                  ) : (
                    <span className={styles.heroAvatarFallback}>{playerInitial}</span>
                  )}
                </div>
                <div className={styles.heroNameBlock}>
                  <span className={styles.heroEyebrow}>operative</span>
                  <h1 className={styles.heroName}>{playerName}</h1>
                  <span className={styles.heroSub}>
                    {completedQuestCount === 0
                      ? 'Pick a quest below to start banking shards.'
                      : `${completedQuestCount} quest${completedQuestCount === 1 ? '' : 's'} cleared this season.`}
                  </span>
                </div>
              </div>

              <div className={styles.heroStats}>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatLabel}>Shard balance</span>
                  <span className={styles.heroStatValueRow}>
                    <Image src="/icons/ui-shard.svg" alt="" width={18} height={18} />
                    <span className={styles.heroStatValue}>{playerProfile?.shardCount ?? 0}</span>
                  </span>
                </div>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatLabel}>Cleared</span>
                  <span className={styles.heroStatValueRow}>
                    <Trophy size={16} weight="fill" className={styles.heroStatIcon} />
                    <span className={styles.heroStatValue}>
                      {completedQuestCount}
                      <span className={styles.heroStatMuted}>/{totalQuestCount}</span>
                    </span>
                  </span>
                </div>
                <div className={styles.heroStat}>
                  <span className={styles.heroStatLabel}>On the table</span>
                  <span className={styles.heroStatValueRow}>
                    <Lightning size={16} weight="fill" className={styles.heroStatIconBolt} />
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
                  <span className={styles.adminToggleHint}>Soul Key</span>
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

            {/* ── Filter pills ── */}
            <nav className={styles.filterRow} aria-label="Filter quests by kind">
              {FILTER_ORDER.map((key) => {
                const count = key === 'all' ? totalQuestCount : countsByKind[key as QuestCardKind];
                if (key !== 'all' && count === 0) return null;
                const active = filter === key;
                return (
                  <button
                    type="button"
                    key={key}
                    className={`${styles.filterPill} ${active ? styles.filterPillActive : ''}`}
                    onClick={() => setFilter(key)}
                    data-kind={key}
                  >
                    <span className={styles.filterPillDot} aria-hidden="true" />
                    <span className={styles.filterPillLabel}>{FILTER_LABEL[key]}</span>
                    <span className={styles.filterPillCount}>{count}</span>
                  </button>
                );
              })}
            </nav>

            {/* ── Quest sections ── */}
            <div className={styles.questBoard}>
              {visibleSections.length === 0 && (
                <div className={styles.emptyState}>
                  <Target size={28} weight="duotone" />
                  <p>No quests match this filter yet.</p>
                </div>
              )}

              {visibleSections.map((kind) => (
                <section key={kind} className={styles.questSection} data-kind={kind}>
                  <header className={styles.sectionHeading}>
                    <div className={styles.sectionHeadingLeft}>
                      <span className={styles.sectionEyebrow} data-kind={kind}>
                        <span className={styles.sectionEyebrowDot} aria-hidden="true" />
                        {FILTER_LABEL[kind]}
                      </span>
                      <h2 className={styles.sectionTitle}>{KIND_SECTION_TITLE[kind]}</h2>
                      <p className={styles.sectionBlurb}>{KIND_SECTION_BLURB[kind]}</p>
                    </div>
                    <span className={styles.sectionMeta}>
                      <ChartLineUp size={11} weight="bold" />
                      {groupedQuests[kind].length} live
                    </span>
                  </header>

                  <div className={styles.cardGrid}>
                    {groupedQuests[kind].map((quest) => (
                      <div key={quest.id} onMouseEnter={() => play('hover')}>
                        <QuestCard
                          title={quest.title}
                          description={quest.desc}
                          progressCurrent={quest.progressCount ?? 0}
                          progressTotal={quest.targetCount ?? 1}
                          points={quest.points}
                          kind={quest.kind}
                          badge={quest.badge}
                          onOpen={() => handleAccept(quest)}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              ))}

              <div className={styles.boardFooter}>
                <AngelMintSection onOpenMintModal={() => setShowMintModal(true)} />
              </div>
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
