'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import WeekTasksView from '@/components/week-tasks/WeekTasksView';
import HomeWelcomeFlow from '@/components/home-welcome/HomeWelcomeFlow';
import MobileSplash from '@/components/mobile-splash/MobileSplash';
import { useSound } from '@/hooks/useSound';
import styles from './page.module.css';

const CyberpunkDataViz = dynamic(() => import('@/components/cyberpunk-data-viz/CyberpunkDataViz'), {
  ssr: false,
  loading: () => null,
});
const DailyReadPopup = dynamic(() => import('@/components/daily-read/DailyReadPopup'), {
  ssr: false,
  loading: () => null,
});
const BookReaderModal = dynamic(() => import('@/components/book-reader/BookReaderModal'), {
  ssr: false,
});
const WeekOneVisualNovel = dynamic(() => import('@/components/visual-novel/WeekOneVisualNovel'), {
  ssr: false,
});
const MintModal = dynamic(() => import('@/components/mint-modal/MintModal'), {
  ssr: false,
});
interface WeekStatus {
  weekNumber: number;
  isSealed: boolean;
  sealTxHash: string | null;
}

const WEEKLY_READINGS = [
  { title: 'Art as Creative Practice', author: '', description: 'This week introduces the habits behind creative recovery.', category: 'Introduction', imageUrl: 'https://i.imgur.com/KkpN9as.png', slug: 'art-is-spiritual-warfare', markdownPath: '/readings/art-is-spiritual-warfare.md' },
  { title: 'A Sense of Safety', author: '', description: 'Establish a foundation of safety to explore your creativity without fear.', category: 'Week 1', imageUrl: '/stories/week-01/1.png', slug: 'sense-of-safety', markdownPath: '/readings/sense-of-safety.md' },
  { title: 'A Sense of Identity', author: '', description: 'The gap between human perception and machine processing. What lives in that space, and how to close it.', category: 'Week 2', imageUrl: '/stories/week-01/8.png', slug: 'sense-of-identity', markdownPath: '/readings/sense-of-identity.md' },
  { title: 'A Sense of Power', author: '', description: 'Anger, shame, and useful signals surface here. This week asks you to reclaim your power and act on it.', category: 'Week 3', imageUrl: '/stories/week-01/12.png', slug: 'sense-of-power', markdownPath: '/readings/sense-of-power.md' },
  { title: 'A Sense of Integrity', author: '', description: 'Align your actions with your deepest values. Integrity is the bridge between vision and reality.', category: 'Week 4', imageUrl: '/stories/week-01/11.png', slug: 'sense-of-integrity', markdownPath: '/readings/sense-of-integrity.md' },
  { title: 'A Sense of Possibility', author: '', description: 'Dismantle the limits you inherited. Possibility is not given — it is reclaimed.', category: 'Week 5', imageUrl: '/stories/week-01/4.png', slug: 'sense-of-possibility', markdownPath: '/readings/sense-of-possibility.md' },
  { title: 'A Sense of Abundance', author: '', description: 'Study the money stories shaping your creative choices, then test better ones.', category: 'Week 6', imageUrl: 'https://i.imgur.com/DqnZ4P5.jpeg', slug: 'sense-of-abundance', markdownPath: '/readings/sense-of-abundance.md' },
  { title: 'A Sense of Connection', author: '', description: 'Creativity is not solitary. Learn to receive support and give it without losing yourself.', category: 'Week 7', imageUrl: '/stories/week-01/5.png', slug: 'sense-of-connection', markdownPath: '/readings/sense-of-connection.md' },
  { title: 'A Sense of Strength', author: '', description: 'Surviving discouragement. The creative life demands resilience, and this week you build it.', category: 'Week 8', imageUrl: 'https://i.imgur.com/6x026dv.jpeg', slug: 'sense-of-strength', markdownPath: '/readings/sense-of-strength.md' },
  { title: 'A Sense of Compassion', author: '', description: 'Fear disguises itself as laziness. Compassion for yourself is the antidote to creative block.', category: 'Week 9', imageUrl: 'https://i.imgur.com/Wiv0PnM.png', slug: 'sense-of-compassion', markdownPath: '/readings/sense-of-compassion.md' },
  { title: 'A Sense of Self-Protection', author: '', description: 'Guard your creative energy. Not every critique deserves a response, not every door needs opening.', category: 'Week 10', imageUrl: 'https://i.imgur.com/86MQLAz.jpeg', slug: 'sense-of-self-protection', markdownPath: '/readings/sense-of-self-protection.md' },
  { title: 'A Sense of Autonomy', author: '', description: 'Own your process. Autonomy is the quiet power that lets your art speak without permission.', category: 'Week 11', imageUrl: 'https://i.imgur.com/RAs9HJk.png', slug: 'sense-of-autonomy', markdownPath: '/readings/sense-of-autonomy.md' },
  { title: 'A Sense of Trust', author: '', description: 'Choose the next concrete action before the full outcome is visible.', category: 'Week 12', imageUrl: 'https://i.imgur.com/Gd2fbry.png', slug: 'sense-of-faith', markdownPath: '/readings/sense-of-faith.md' },
];

const WEEK_TITLES = [
  'Week 0', 'Week 1', 'Week 2', 'Week 3', 'Week 4',
  'Week 5', 'Week 6', 'Week 7', 'Week 8',
  'Week 9', 'Week 10', 'Week 11', 'Week 12', 'Week 13',
];

function parseMarkdownSimple(md: string): string {
  let html = md
    .replace(/^---$/gm, '<hr />')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.split('\n\n').map(p => {
    const t = p.trim();
    if (!t) return '';
    if (/^<[h1-6hr]/.test(t)) return t;
    return `<p>${t}</p>`;
  }).join('\n');
  return html;
}

interface CourseInlineReaderProps {
  reading: typeof WEEKLY_READINGS[0];
  onBack: () => void;
}

function CourseInlineReader({ reading, onBack }: CourseInlineReaderProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setContent('');
    fetch(reading.markdownPath)
      .then(r => r.text())
      .then(text => { setContent(text); setLoading(false); })
      .catch(() => setLoading(false));
  }, [reading.markdownPath]);

  return (
    <div className={styles.inlineReader}>
      <button type="button" className={styles.inlineReaderBack} onClick={onBack}>
        ← Back to Journal
      </button>
      <div className={styles.inlineReaderHeader}>
        <span className={styles.inlineReaderCategory}>{reading.category}</span>
        <h2 className={styles.inlineReaderTitle}>{reading.title}</h2>
      </div>
      {loading ? (
        <div className={styles.inlineReaderLoading}>
          <div className={`${styles.skeletonBlock}`} style={{ height: 16, borderRadius: 8, marginBottom: 8 }} />
          <div className={`${styles.skeletonBlock}`} style={{ height: 16, borderRadius: 8, width: '80%', marginBottom: 8 }} />
          <div className={`${styles.skeletonBlock}`} style={{ height: 16, borderRadius: 8, width: '60%' }} />
        </div>
      ) : (
        <div
          className={styles.inlineReaderBody}
          dangerouslySetInnerHTML={{ __html: parseMarkdownSimple(content) }}
        />
      )}
    </div>
  );
}

export default function CoursePage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [showAmbientViz, setShowAmbientViz] = useState(false);
  const [seasonLoading, setSeasonLoading] = useState(true);
  const [weekStatuses, setWeekStatuses] = useState<WeekStatus[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authFlowSettled, setAuthFlowSettled] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);
  const [isWeekOneNovelOpen, setIsWeekOneNovelOpen] = useState(false);
  const [readerIndex, setReaderIndex] = useState(0);
  const [activeWeek, setActiveWeek] = useState<number>(0);
  const [viewWeek, setViewWeek] = useState<number | null>(null);
  const [weekEndsAt, setWeekEndsAt] = useState<string | null>(null);
  const [swipeAnim, setSwipeAnim] = useState<'none' | 'left' | 'right'>('none');
  const [showMintModal, setShowMintModal] = useState(false);
  const { play } = useSound();
  const currentReading = WEEKLY_READINGS[readerIndex];

  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isSwiping = useRef(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleId: number | null = null;

    const revealAmbientViz = () => setShowAmbientViz(true);

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(revealAmbientViz, { timeout: 1200 });
    } else {
      timeoutId = setTimeout(revealAmbientViz, 300);
    }

    return () => {
      if (idleId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

  useEffect(() => {
    fetch('/api/season', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const week = data.currentWeek ?? 0;
        setActiveWeek(week);
        setViewWeek(Math.max(week, 1));
        setWeekEndsAt(data.weekEndsAt ?? null);
      })
      .catch(() => {
        setViewWeek(1);
      })
      .finally(() => {
        setSeasonLoading(false);
      });
  }, [getAccessToken]);

  const refreshAuth = useCallback(async () => {
    if (!ready || !authenticated) return;
    try {
      const token = await getAccessToken();
      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const meRes = await fetch('/api/me', { credentials: 'include', cache: 'no-store', headers: authHeaders });
      const meData = await meRes.json().catch(() => ({ user: null }));
      if (!meData?.user) return;
      setIsAuthenticated(true);
      const res = await fetch('/api/ethereal-progress/all', { credentials: 'include', headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setWeekStatuses(data.weeks);
      }
    } catch {}
  }, [ready, authenticated, getAccessToken]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const handler = () => refreshAuth();
    window.addEventListener('userLoaded', handler);
    window.addEventListener('userLoggedIn', handler);
    return () => {
      window.removeEventListener('userLoaded', handler);
      window.removeEventListener('userLoggedIn', handler);
    };
  }, [refreshAuth]);

  const handleSealComplete = useCallback((weekNumber: number, txHash: string | null) => {
    // Close any open task panel so the user lands on the sealed week
    // overview rather than a now-locked task editor.
    setRightContent(prev => (prev === 'task' ? null : prev));
    setSelectedTaskId(null);
    setWeekStatuses(prev => {
      const hasWeek = prev.some(w => w.weekNumber === weekNumber);
      if (!hasWeek) {
        return [...prev, { weekNumber, isSealed: true, sealTxHash: txHash }].sort((a, b) => a.weekNumber - b.weekNumber);
      }

      return prev.map(w =>
        w.weekNumber === weekNumber ? { ...w, isSealed: true, sealTxHash: txHash } : w
      );
    });
  }, []);

  const getWeekStatus = (week: number) => weekStatuses.find(w => w.weekNumber === week);

  // Desktop renders the mission list and the task module as separate WeekTasksView
  // instances. This mirrors completions toggled in the module back to the list.
  const [liveCompletions, setLiveCompletions] = useState<Record<number, string[]>>({});
  const handleCompletionChange = useCallback((week: number, completedSectionIds: string[]) => {
    setLiveCompletions(prev => ({ ...prev, [week]: completedSectionIds }));
  }, []);

  const handleFocus = useCallback((e: React.FocusEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') play('hover');
  }, [play]);

  const handleWelcomeAuthenticated = useCallback(() => {
    setIsAuthenticated(true);
    (async () => {
      try {
        const token = await getAccessToken();
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const meRes = await fetch('/api/me', { credentials: 'include', cache: 'no-store', headers: authHeaders });
        const meData = await meRes.json().catch(() => ({ user: null }));
        if (meData?.user) {
          const res = await fetch('/api/ethereal-progress/all', { credentials: 'include', headers: authHeaders });
          if (res.ok) {
            const data = await res.json();
            setWeekStatuses(data.weeks);
          }
        }
      } catch {}
    })();
  }, [getAccessToken]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    isSwiping.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchCurrentX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!isSwiping.current) return;
    isSwiping.current = false;
    if (viewWeek === null) return;
    const currentWeek = viewWeek;
    const diff = touchStartX.current - touchCurrentX.current;
    const threshold = 60;

    if (diff > threshold && currentWeek < 12) {
      setSwipeAnim('left');
      setTimeout(() => {
        setViewWeek(w => (w ?? 1) + 1);
        setSwipeAnim('none');
      }, 150);
      play('click');
    } else if (diff < -threshold && currentWeek > 1) {
      setSwipeAnim('right');
      setTimeout(() => {
        setViewWeek(w => (w ?? 2) - 1);
        setSwipeAnim('none');
      }, 150);
      play('click');
    }
  };

  const goToWeek = (dir: 'prev' | 'next') => {
    if (viewWeek === null) return;
    const currentWeek = viewWeek;
    if (dir === 'next' && currentWeek < 12) {
      setSwipeAnim('left');
      setTimeout(() => { setViewWeek(w => (w ?? 1) + 1); setSwipeAnim('none'); }, 150);
      play('click');
    } else if (dir === 'prev' && currentWeek > 1) {
      setSwipeAnim('right');
      setTimeout(() => { setViewWeek(w => (w ?? 2) - 1); setSwipeAnim('none'); }, 150);
      play('click');
    }
  };

  const resolvedViewWeek = viewWeek ?? 1;
  const weekReading = WEEKLY_READINGS[Math.min(resolvedViewWeek, WEEKLY_READINGS.length - 1)];
  const handleOpenReading = useCallback((index: number) => {
    const reading = WEEKLY_READINGS[index];
    if (reading?.slug === 'sense-of-safety') {
      setReaderIndex(index);
      setIsWeekOneNovelOpen(true);
      return;
    }

    setReaderIndex(index);
    setIsReaderOpen(true);
  }, []);

  const [rightContent, setRightContent] = useState<'reading' | 'task' | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <>
    <MobileSplash />
    <HomeWelcomeFlow onAuthenticated={handleWelcomeAuthenticated} onSettled={() => setAuthFlowSettled(true)}>
    {authFlowSettled && activeWeek > 0 && <DailyReadPopup activeWeek={activeWeek} />}
    <div className={styles.pageLayout}>
      {showAmbientViz && (
        <div className={styles.bgViz}>
          <CyberpunkDataViz />
        </div>
      )}
      <SideNavigation />
      <main className={`${styles.content} ${isDesktop ? styles.contentDesktop : ''}`} onFocus={handleFocus}>

        {/* ── Left / main column — identical to original ── */}
        <div className={isDesktop ? styles.leftCol : undefined}>

          <div className={styles.weekHeader}>
            <button
              className={styles.weekArrow}
              onClick={() => goToWeek('prev')}
              onMouseEnter={() => play('hover')}
              disabled={seasonLoading || resolvedViewWeek <= 1}
              aria-label="Previous week"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
            </button>
            <div className={styles.weekHeaderCenter}>
              {seasonLoading ? (
                <span className={`${styles.weekTitle} ${styles.skeletonTextWide} ${styles.skeletonBlock}`} />
              ) : (
                <span className={styles.weekTitle}>{WEEK_TITLES[resolvedViewWeek]}</span>
              )}
            </div>
            <button
              className={styles.weekArrow}
              onClick={() => goToWeek('next')}
              onMouseEnter={() => play('hover')}
              disabled={seasonLoading || resolvedViewWeek >= 12}
              aria-label="Next week"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>
          </div>

          <div className={styles.weekDots}>
            {Array.from({ length: 12 }, (_, i) => {
              const w = i + 1;
              const status = getWeekStatus(w);
              return (
                <button
                  key={w}
                  className={`${styles.weekDot} ${!seasonLoading && w === resolvedViewWeek ? styles.weekDotActive : ''} ${status?.isSealed ? styles.weekDotSealed : ''} ${seasonLoading ? styles.weekDotLoading : ''}`}
                  onClick={() => { play('click'); setViewWeek(w); }}
                  title={`Week ${w}: ${WEEK_TITLES[w]}`}
                  disabled={seasonLoading}
                />
              );
            })}
          </div>

          <div
            className={`${styles.weekContent} ${swipeAnim === 'left' ? styles.weekContentSwipeLeft : swipeAnim === 'right' ? styles.weekContentSwipeRight : ''}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {seasonLoading || viewWeek === null ? (
              <>
                <div className={styles.readingCardSkeleton}>
                  <div className={`${styles.readingMediaSkeleton} ${styles.skeletonBlock}`} />
                  <div className={styles.readingInfo}>
                    <span className={`${styles.readingCategorySkeletonLine} ${styles.skeletonBlock}`} />
                    <span className={`${styles.readingTitleSkeletonLine} ${styles.skeletonBlock}`} />
                    <span className={`${styles.readingAuthorSkeletonLine} ${styles.skeletonBlock}`} />
                  </div>
                </div>
                <div className={styles.weekTasksSkeleton}>
                  <div className={`${styles.taskCardSkeleton} ${styles.skeletonBlock}`} />
                  <div className={`${styles.taskCardSkeleton} ${styles.skeletonBlock}`} />
                  <div className={`${styles.taskCardSkeleton} ${styles.skeletonBlock}`} />
                  <div className={`${styles.sealButtonSkeleton} ${styles.skeletonBlock}`} />
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`${styles.readingCard} ${isDesktop && rightContent === 'reading' ? styles.readingCardActive : ''}`}
                  onClick={() => {
                    play('click');
                    const idx = Math.min(resolvedViewWeek, WEEKLY_READINGS.length - 1);
                    const reading = WEEKLY_READINGS[idx];
                    if (isDesktop && reading?.slug !== 'sense-of-safety') {
                      setReaderIndex(idx);
                      setRightContent('reading');
                    } else {
                      handleOpenReading(idx);
                    }
                  }}
                  onMouseEnter={() => play('hover')}
                >
                  <span
                    className={styles.readingThumb}
                    style={{ backgroundImage: `url(${JSON.stringify(weekReading.imageUrl)})` }}
                    aria-hidden="true"
                  />
                  <div className={styles.readingInfo}>
                    <span className={styles.readingCategory}>{weekReading.category}</span>
                    <span className={styles.readingTitle}>{weekReading.title}</span>
                  </div>
                  <svg className={styles.readingArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>

                <div className={styles.missionsHeadingRow} aria-hidden="true">
                  <span className={styles.missionsDivider} />
                  <h2 className={styles.missionsHeading}>Missions</h2>
                  <span className={styles.missionsDivider} />
                </div>

                <WeekTasksView
                  key={resolvedViewWeek}
                  weekNumber={resolvedViewWeek}
                  enablePersistence={isAuthenticated}
                  isLocked={resolvedViewWeek > activeWeek}
                  initialIsSealed={getWeekStatus(resolvedViewWeek)?.isSealed}
                  initialSealTxHash={getWeekStatus(resolvedViewWeek)?.sealTxHash}
                  onSealComplete={handleSealComplete}
                  onSectionSelect={isDesktop ? (id) => { setSelectedTaskId(id); setRightContent('task'); } : undefined}
                  disableAutoSave={isDesktop}
                  syncedCompletedSections={isDesktop ? liveCompletions[resolvedViewWeek] : undefined}
                />
              </>
            )}
          </div>

        </div>

        {/* ── Right panel (desktop only) ── */}
        {isDesktop && rightContent !== null && (
          <div className={styles.rightPanel}>
            {rightContent === 'reading' && (
              <CourseInlineReader
                reading={WEEKLY_READINGS[readerIndex]}
                onBack={() => setRightContent(null)}
              />
            )}
            {rightContent === 'task' && selectedTaskId && (
              <WeekTasksView
                key={`panel-${resolvedViewWeek}`}
                weekNumber={resolvedViewWeek}
                enablePersistence={isAuthenticated}
                isLocked={resolvedViewWeek > activeWeek}
                initialIsSealed={getWeekStatus(resolvedViewWeek)?.isSealed}
                initialSealTxHash={getWeekStatus(resolvedViewWeek)?.sealTxHash}
                onSealComplete={handleSealComplete}
                onCompletionChange={handleCompletionChange}
                focusedSectionId={selectedTaskId}
              />
            )}
          </div>
        )}

      </main>

      {isReaderOpen && (
        <BookReaderModal
          isOpen={isReaderOpen}
          onClose={() => setIsReaderOpen(false)}
          title={currentReading.title}
          author={currentReading.author}
          markdownPath={currentReading.markdownPath}
          slug={currentReading.slug}
        />
      )}
      {isWeekOneNovelOpen && (
        <WeekOneVisualNovel
          isOpen={isWeekOneNovelOpen}
          onClose={() => setIsWeekOneNovelOpen(false)}
        />
      )}
      {showMintModal && <MintModal isOpen={showMintModal} onClose={() => setShowMintModal(false)} />}

    </div>
    </HomeWelcomeFlow>
    </>
  );
}
