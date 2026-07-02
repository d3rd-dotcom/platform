'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DailyReadPopup from './DailyReadPopup';
import { getStorageItem } from '@/lib/safe-storage';

const INTRO_SEEN_KEY = 'mwa-home-intro-seen';

/**
 * Blue's weekly intro on the home dashboard, once per season week (the popup
 * self-gates on dailyReadLastSeenWeek). Defers to the first-run guide: it
 * stays hidden until the FeatureTour intro has been seen, so a new member
 * never gets two overlays stacked on their first visit.
 */
export default function WeeklyIntroPopup() {
  const router = useRouter();
  const [activeWeek, setActiveWeek] = useState(0);

  useEffect(() => {
    if (getStorageItem(INTRO_SEEN_KEY) !== '1') return;
    let cancelled = false;
    fetch('/api/season', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const week = Number(data.currentWeek ?? 0);
        if (Number.isFinite(week) && week > 0) setActiveWeek(week);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (activeWeek <= 0) return null;
  return <DailyReadPopup activeWeek={activeWeek} onCta={() => router.push('/course')} />;
}
