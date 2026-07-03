'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { PencilSimple } from '@phosphor-icons/react';
import Link from 'next/link';
import AvatarSelectorModal from '@/components/avatar-selector/AvatarSelectorModal';
import UsernameChangeModal from '@/components/username-change/UsernameChangeModal';
import { QUEST_DEFINITIONS, type QuestDefinition } from '@/lib/quest-definitions';
import { useSound } from '@/hooks/useSound';
import styles from './ProfileDashboard.module.css';

/* Level curve: quadratic on diamonds so early levels come fast.
   0 → 1, 100 → 3, 625 → 6, 2432 → 10 */
function levelFromDiamonds(diamonds: number): number {
  return Math.floor(Math.sqrt(Math.max(0, diamonds) / 25)) + 1;
}

/* Accolade titles earned by diamond count */
const ACCOLADES: Array<[number, string]> = [
  [5000, 'Infinite Potential'],
  [2000, 'Digital Alchemist'],
  [1000, 'Dream Architect'],
  [400, 'Mind Cartographer'],
  [100, 'Field Scholar'],
  [0, 'Curious Seeker'],
];

function accoladeFromDiamonds(diamonds: number): string {
  return ACCOLADES.find(([min]) => diamonds >= min)?.[1] ?? 'Curious Seeker';
}

interface ProfileDashboardProps {
  bannerUrl?: string | null;
  coursesCount?: number;
  bio?: string | null;
}

export default function ProfileDashboard({
  bannerUrl,
  coursesCount = 0,
  bio = null,
}: ProfileDashboardProps) {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const { play } = useSound();
  const [username, setUsername] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [diamonds, setDiamonds] = useState(0);
  const [streak, setStreak] = useState(0);
  const [hasVip, setHasVip] = useState(false);
  const [hasAngel, setHasAngel] = useState(false);
  const [currentQuest, setCurrentQuest] = useState<QuestDefinition | null>(null);
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [editingUsername, setEditingUsername] = useState(false);

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
        setDiamonds(data.user.shardCount ?? 0);
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

    fetch('/api/daily-notes/streak', { credentials: 'include' })
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

  const level = levelFromDiamonds(diamonds);
  const badgesHeld = (hasAngel ? 1 : 0) + (hasVip ? 1 : 0);

  return (
    <section className={styles.panel}>
      <div
        className={styles.banner}
        style={bannerUrl ? { backgroundImage: `url(${JSON.stringify(bannerUrl)})` } : undefined}
      />
      <button
        type="button"
        className={styles.avatar}
        style={avatarUrl ? { backgroundImage: `url(${JSON.stringify(avatarUrl)})` } : undefined}
        onClick={() => {
          play('click');
          authenticated && setEditingAvatar(true);
        }}
        onMouseEnter={() => play('soft-hover')}
        title={authenticated ? 'Change avatar' : undefined}
        aria-label="Change avatar"
      >
        {!avatarUrl && username ? username[0].toUpperCase() : ''}
      </button>

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{username ? `@${username}` : 'User Profile'}</h2>
          {authenticated && (
            <button
              type="button"
              className={styles.editBtn}
              onClick={() => {
                play('click');
                setEditingUsername(true);
              }}
              onMouseEnter={() => play('soft-hover')}
              title="Edit username"
              aria-label="Edit username"
            >
              <PencilSimple size={14} weight="bold" />
            </button>
          )}
        </div>
        <span className={styles.levelPill}>Level {level}</span>
        <div className={styles.headerDivider} />
      </div>

      <div className={styles.about}>
        <span className={styles.headline}>{accoladeFromDiamonds(diamonds)}</span>
        {bio ? (
          <p className={styles.description}>{bio}</p>
        ) : (
          <p className={`${styles.description} ${styles.bioPlaceholder}`}>
            Your bio lives here — tell the Academy who you are and what you are exploring.
          </p>
        )}
      </div>

      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>{diamonds.toLocaleString()}</span>
          <span className={styles.statLabel}>Diamonds</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{coursesCount}</span>
          <span className={styles.statLabel}>{coursesCount === 1 ? 'Course' : 'Courses'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{badgesHeld}</span>
          <span className={styles.statLabel}>{badgesHeld === 1 ? 'Badge' : 'Badges'}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statValue}>{streak}</span>
          <span className={styles.statLabel}>Streak</span>
        </div>
      </div>

      <div className={styles.mission}>
        <span className={styles.missionHeading}>Current Quest</span>
        {currentQuest ? (
          <Link
            href="/quests"
            className={styles.missionCard}
            onMouseEnter={() => play('hover')}
            onClick={() => play('click')}
          >
            <span className={styles.questPoints}>
              <img src="/icons/ui-diamond.svg" alt="" className={styles.questDiamond} />
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

      <div className={styles.badges}>
        <span className={styles.missionHeading}>Badges</span>
        <div className={styles.badgeRow}>
          <div
            className={`${styles.badge} ${hasAngel ? '' : styles.badgeLocked}`}
            onMouseEnter={() => play('soft-hover')}
          >
            <span
              className={styles.badgeArt}
              style={{ backgroundImage: "url('/anbel01.png')" }}
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
    </section>
  );
}
