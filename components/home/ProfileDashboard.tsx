'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

import AvatarSelectorModal from '@/components/avatar-selector/AvatarSelectorModal';
import UsernameChangeModal from '@/components/username-change/UsernameChangeModal';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import CourseFolderCard from '@/components/home/CourseFolderCard';
import { useAccount } from 'wagmi';
import { fetchDiamondBalance } from '@/lib/diamonds-balance';
import { useSound } from '@/hooks/useSound';
import styles from './ProfileDashboard.module.css';

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
        setCreditDiamonds(data.user.shardCount ?? 0);
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    loadMe();

    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch(`/api/daily-notes/streak?tz=${encodeURIComponent(timeZone)}`, { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStreak(d?.streak ?? 0))
      .catch(() => {});
  }, [ready, authenticated, loadMe]);

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
      <div className={styles.fieldNotesSection}>
        <DailyNotes
          enablePersistence={authenticated && ready}
          compact
        />
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
