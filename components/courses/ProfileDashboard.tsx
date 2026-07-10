'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';

import Link from 'next/link';
import AvatarSelectorModal from '@/components/avatar-selector/AvatarSelectorModal';
import UsernameChangeModal from '@/components/username-change/UsernameChangeModal';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import CourseFolderCard from '@/components/courses/CourseFolderCard';
import { useAccount } from 'wagmi';
import { QUEST_DEFINITIONS, type QuestDefinition } from '@/lib/quest-definitions';
import { fetchDiamondBalance } from '@/lib/diamonds-balance';
import { useSound } from '@/hooks/useSound';
import styles from './ProfileDashboard.module.css';

type PanelTab = 'badges' | 'certificates' | 'quests';

export interface PanelCourse {
  title: string;
  href: string;
  progressPct: number;
}

interface ProfileDashboardProps {
  bannerUrl?: string | null;
  courses?: PanelCourse[];
  bio?: string | null;
  noteCount?: number;
  onOpenNotes?: () => void;
  questFolder?: { title: string; count: number; href: string };
}

export default function ProfileDashboard({
  bannerUrl,
  courses = [],
  bio = null,
  noteCount = 0,
  onOpenNotes,
  questFolder,
}: ProfileDashboardProps) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { address } = useAccount();
  const { play } = useSound();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [creditDiamonds, setCreditDiamonds] = useState(0);
  const [chainDiamonds, setChainDiamonds] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [hasVip, setHasVip] = useState(false);
  const [hasAngel, setHasAngel] = useState(false);
  const [currentQuest, setCurrentQuest] = useState<QuestDefinition | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);
  const [tab, setTab] = useState<PanelTab>('badges');

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  const loadMe = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include', headers });
      const data = await res.json().catch(() => ({}));
      if (data?.user) {
        setUsername(data.user.username ?? null);
        setAvatarUrl(data.user.avatarUrl ?? null);
        setCreditDiamonds(data.user.shardCount ?? 0);
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    loadMe();

    fetch('/api/account/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        setHasVip(d?.hasVipMembershipCard ?? false);
        setHasAngel(d?.hasAcademicAngel ?? false);
      })
      .catch(() => {});

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/daily-notes/streak?tz=${encodeURIComponent(timeZone)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStreak(d?.streak ?? 0))
      .catch(() => {});

    authHeaders().then((headers) =>
      fetch('/api/quests/progress', { cache: 'no-store', credentials: 'include', headers })
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          const counts: Record<string, number> = d?.counts ?? {};
          const next = QUEST_DEFINITIONS.find((q) => (counts[q.key] ?? 0) < q.targetCount);
          setCurrentQuest(next ?? null);
        })
        .catch(() => {})
    );
  }, [ready, authenticated, loadMe, authHeaders]);

  // Signed-out fallback: show the first quest as a teaser
  useEffect(() => {
    if (ready && !authenticated) setCurrentQuest(QUEST_DEFINITIONS[0]);
  }, [ready, authenticated]);

  // Chain is the source of truth for diamonds: prefer the live $BLUE balance
  // over the in-app mirror whenever the wallet reads successfully.
  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    fetchDiamondBalance(address).then((balance) => {
      if (!cancelled && balance !== null) setChainDiamonds(balance);
    });
    return () => { cancelled = true; };
  }, [address]);

  return (
    <section className={styles.panel}>
      <div className={styles.mission}>
        <div className={styles.tabRow}>
          {(['badges', 'certificates', 'quests'] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
              onClick={() => { play('click'); setTab(t); }}
              onMouseEnter={() => play('soft-hover')}
            >
              {t === 'badges' ? 'Items' : t === 'certificates' ? 'Awards' : 'Quests'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.fieldNotesSection}>
        <DailyNotes
          enablePersistence={authenticated && ready}
          compact
        />
      </div>

      {tab === 'quests' && (
      <div className={styles.badges}>
        <span className={styles.missionHeading}>Current Quest</span>
        {currentQuest ? (
          <Link
            href="/quests"
            className={styles.missionCard}
            onMouseEnter={() => play('hover')}
            onClick={() => play('click')}
          >
            <span className={styles.questPoints}>
              <Image src="/icons/ui-diamond.svg" alt="" width={16} height={16} className={styles.questDiamond} />
              {currentQuest.points}
            </span>
            <span className={styles.questBody}>
              <span className={styles.questTitle}>{currentQuest.title}</span>
              <span className={styles.questDesc}>{currentQuest.desc}</span>
            </span>
          </Link>
        ) : (
          <div className={styles.missionCard}>
            <span className={styles.questBody}>
              <span className={styles.questTitle}>All quests complete</span>
              <span className={styles.questDesc}>New quests are on the way. Nice work.</span>
            </span>
          </div>
        )}
      </div>
      )}

      {tab === 'badges' && (
      <div className={styles.badges}>
        <span className={styles.missionHeading}>Items</span>
        <div className={styles.badgeRow}>
          <div
            className={`${styles.badge} ${hasAngel ? '' : styles.badgeLocked}`}
            onMouseEnter={() => play('soft-hover')}
          >
            <span
              className={styles.badgeArt}
              style={{ backgroundImage: "url('/anbel03.png')" }}
            />
            <span className={styles.badgeInfo}>
              <span className={styles.badgeName}>Membership</span>
              <span className={styles.badgeState}>{hasAngel ? 'Held' : 'Locked'}</span>
            </span>
          </div>
          <div
            className={`${styles.badge} ${hasVip ? '' : styles.badgeLocked}`}
            onMouseEnter={() => play('soft-hover')}
          >
            <span
              className={`${styles.badgeArt} ${styles.badgeArtCard}`}
              style={{ backgroundImage: "url('/uploads/vip-membership-card.png')" }}
            />
            <span className={styles.badgeInfo}>
              <span className={styles.badgeName}>Soul Key</span>
              <span className={styles.badgeState}>{hasVip ? 'Held' : 'Locked'}</span>
            </span>
          </div>
        </div>
      </div>
      )}

      {tab === 'certificates' && (
        <div className={styles.badges}>
          <span className={styles.missionHeading}>Awards</span>
          {courses.length > 0 ? (
            <div className={styles.courseList}>
              {courses.map((c) => {
                const earned = c.progressPct >= 100;
                return (
                  <div key={c.href} className={`${styles.certRow} ${earned ? '' : styles.certLocked}`}>
                    <span className={styles.certSealMark}>{earned ? '✓' : ''}</span>
                    <span className={styles.certInfo}>
                      <span className={styles.courseRowTitle}>{c.title}</span>
                      <span className={styles.certState}>
                        {earned ? 'Earned — minting coming soon' : `Complete ${c.title} to earn this certificate`}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.tabPanel}>No certificates yet. Finish a full course to earn your first one.</div>
          )}
        </div>
      )}

      {editingAvatar && (
        <AvatarSelectorModal
          onClose={() => setEditingAvatar(false)}
          onAvatarSelected={(url) => {
            setAvatarUrl(url);
            setEditingAvatar(false);
          }}
        />
      )}
      {editingUsername && username && (
        <UsernameChangeModal
          currentUsername={username}
          onClose={() => setEditingUsername(false)}
          onUsernameChanged={(name) => {
            setUsername(name);
            setEditingUsername(false);
          }}
        />
      )}

      {questFolder && (
        <div className={styles.questFolderWrap}>
          <CourseFolderCard
            title={questFolder.title}
            count={questFolder.count}
            href={questFolder.href}
            images={[]}
          />
        </div>
      )}
    </section>
  );
}
