'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Plus, CaretUp, CaretDown, Rows, GridFour, Cube, CaretLeft, CaretRight, TreeStructure } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import { scriptForWeek, WEEKLY_SEEN_KEY } from '@/components/daily-read/weeklyScripts';
import CourseFolderCard from '@/components/home/CourseFolderCard';
import FolderCardWrapper from '@/components/home/FolderCardWrapper';
import ProfileDashboard from '@/components/home/ProfileDashboard';
import DailyNotes from '@/components/daily-notes/DailyNotes';
import FieldNotesSheet from '@/components/home/FieldNotesSheet';
import StatsChart from '@/components/home/StatsChart';
import FeatureTour from '@/components/feature-tour/FeatureTour';

import type { CourseData } from '@/lib/personal-course';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
import type { CourseRecord } from '@/lib/course-content-db';
import type { GuideRecord, FrontierGuide } from '@/lib/guides-db';
import { useSound } from '@/hooks/useSound';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './page.module.css';

const COURSES_INTRO_SEEN_KEY = 'mwa-courses-intro-seen';
const COURSES_DIALOGUE_DATE_KEY = 'mwa-courses-dialogue-date';

interface CourseDialogue {
  emotion: 'neutral' | 'happy' | 'confused' | 'surprised' | 'calm';
  lines: string[];
}

const FIRST_COURSES_DIALOGUE: CourseDialogue = {
  emotion: 'neutral',
  lines: [
    'I keep the Academy learning records. This page is where courses and field notes meet.',
    'Continue a course or record an observation. I remember what you finish.',
    'Completing lessons earns credits. Your progress stays with you.',
  ],
};

const DAILY_COURSES_DIALOGUES: CourseDialogue[] = [
  {
    emotion: 'calm',
    lines: [
      'One completed lesson teaches me more than five open tabs.',
      'Choose one task. Finish it, then return for the next session.',
    ],
  },
  {
    emotion: 'neutral',
    lines: [
      'Retrieval strengthens memory.',
      'Read one guide, close it, then explain the idea without looking.',
    ],
  },
  {
    emotion: 'confused',
    lines: [
      'I found several unfinished threads in the learning record.',
      'Pick one lesson small enough to complete today. Give me a clean result.',
    ],
  },
  {
    emotion: 'surprised',
    lines: [
      'A field note can turn a passing thought into evidence.',
      'Capture one pattern or anomaly before memory rewrites it.',
    ],
  },
  {
    emotion: 'calm',
    lines: [
      'A course holds a sequence of useful practice.',
      'Finish one session before opening the next thread.',
    ],
  },
  {
    emotion: 'happy',
    lines: [
      'A course is a hypothesis with a schedule.',
      'Build one when you can name what should change by the final week.',
    ],
  },
  {
    emotion: 'neutral',
    lines: [
      'Questions improve when you return to them.',
      'Choose one topic you can test, revise, and study from another angle.',
    ],
  },
];

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dialogueIndexForDate(dateKey: string): number {
  let hash = 0;
  for (const character of dateKey) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % DAILY_COURSES_DIALOGUES.length;
}

export default function HomePage() {
  const learnOnly = usePathname() === '/learn';
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [personalCourse, setPersonalCourse] = useState<CourseData | null>(null);
  const [academyCourses, setAcademyCourses] = useState<CourseRecord[]>([]);
  const [guides, setGuides] = useState<GuideRecord[]>([]);
  const [myGuides, setMyGuides] = useState<GuideRecord[]>([]);
  const [guideProgress, setGuideProgress] = useState<{
    totalGuides: number;
    completedGuides: number;
    totalDiamondsEarned: number;
    subjects: Array<{ subject: string; total: number; completed: number }>;
    lastCompletedAt: string | null;
  } | null>(null);
  const [authorStats, setAuthorStats] = useState<{
    totalAuthored: number;
    publishedCount: number;
    totalLearnerCompletions: number;
    totalUpvotes: number;
    totalDownvotes: number;
  } | null>(null);
  const [frontierGuides, setFrontierGuides] = useState<FrontierGuide[] | null>(null);

  const [isVip, setIsVip] = useState(false);
  const [fieldNotesOpen, setFieldNotesOpen] = useState(false);
  const [notebookEntriesUnlocked, setNotebookEntriesUnlocked] = useState(false);
  const [courseIndicators, setCourseIndicators] = useState({ completed: 0, inProgress: 0, saved: 0 });
  const [introOpen, setIntroOpen] = useState(false);
  const [courseDialogue, setCourseDialogue] = useState<CourseDialogue>(
    FIRST_COURSES_DIALOGUE,
  );
  const [weeklyWeek, setWeeklyWeek] = useState(0);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [featuredPage, setFeaturedPage] = useState(0);
  const [guideView, setGuideView] = useState<'card' | 'list' | '3d'>('card');
  const { play } = useSound();

  // One Blue moment per day, by priority: first-run intro, then the season
  // week's intro/check-in (once per week, centered pop-up), then the daily
  // line. The weekly check-in lives here because field notes do.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const today = localDateKey();
    if (getStorageItem(COURSES_DIALOGUE_DATE_KEY) === today) return;

    const hasSeenIntro = getStorageItem(COURSES_INTRO_SEEN_KEY) === 'true';
    let cancelled = false;
    let timer: number | undefined;

    const openDaily = () => {
      const dialogue = hasSeenIntro
        ? DAILY_COURSES_DIALOGUES[dialogueIndexForDate(today)]
        : FIRST_COURSES_DIALOGUE;

      setCourseDialogue(dialogue);
      setStorageItem(COURSES_DIALOGUE_DATE_KEY, today);
      if (!hasSeenIntro) setStorageItem(COURSES_INTRO_SEEN_KEY, 'true');
      timer = window.setTimeout(() => setIntroOpen(true), 500);
    };

    // A brand-new member gets the first-run intro; the weekly check-in waits
    // for a later visit so two big moments never land at once.
    if (!hasSeenIntro) {
      openDaily();
      return () => {
        if (timer) window.clearTimeout(timer);
      };
    }

    fetch('/api/season', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const week = Number(data?.currentWeek ?? 0);
        const weeklyDue =
          Number.isFinite(week) &&
          week > 0 &&
          getStorageItem(WEEKLY_SEEN_KEY) !== String(week);
        if (weeklyDue) {
          setWeeklyWeek(week);
          setStorageItem(COURSES_DIALOGUE_DATE_KEY, today);
          timer = window.setTimeout(() => setWeeklyOpen(true), 500);
        } else {
          openDaily();
        }
      })
      .catch(() => {
        if (!cancelled) openDaily();
      });

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const handleIntroClose = () => {
    setIntroOpen(false);
  };

  const handleWeeklyClose = () => {
    setStorageItem(WEEKLY_SEEN_KEY, String(weeklyWeek));
    setWeeklyOpen(false);
  };

  const weeklyScript = weeklyWeek > 0 ? scriptForWeek(weeklyWeek) : null;

  useEffect(() => {
    fetch('/api/course-content')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.courses) setAcademyCourses(d.courses);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!learnOnly) return;
    fetch('/api/guides?status=published')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.guides) setGuides(d.guides);
      })
      .catch(() => {});
  }, [learnOnly]);

  useEffect(() => {
    if (!learnOnly || !ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/progress/stats', { cache: 'no-store', headers });
        if (res.ok) setGuideProgress(await res.json());
      } catch {}
    })();
  }, [learnOnly, ready, authenticated, getAccessToken]);

  useEffect(() => {
    if (!learnOnly || !ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/frontier', { cache: 'no-store', headers });
        if (res.ok) {
          const d = await res.json();
          setFrontierGuides(d.guides ?? []);
        }
      } catch {}
    })();
  }, [learnOnly, ready, authenticated, getAccessToken]);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) {
      setNotebookEntriesUnlocked(false);
      return;
    }

    (async () => {
      try {
        const headers = await authHeaders();
        const res = await fetch('/api/me', { cache: 'no-store', credentials: 'include', headers });
        if (!res.ok) return;
        const data = await res.json();
        setNotebookEntriesUnlocked((data?.user?.shardCount ?? 0) >= 3_000);
      } catch {
        setNotebookEntriesUnlocked(false);
      }
    })();
  }, [ready, authenticated, authHeaders]);

  const loadPersonalCourse = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(personalCourseUrl(), { cache: 'no-store', headers });
      const data = await res.json().catch(() => ({}));
      const record = data?.course;
      if (record?.status === 'ready' && record?.courseData?.weeks?.length) {
        setPersonalCourse(record.courseData as CourseData);
      } else {
        setPersonalCourse(null);
      }
    } catch {
      setPersonalCourse(null);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    loadPersonalCourse();
  }, [ready, loadPersonalCourse]);

  useEffect(() => {
    if (!ready || !authenticated) return;
    fetch('/api/account/status')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setIsVip(d?.hasVipMembershipCard ?? false))
      .catch(() => setIsVip(false));

  }, [ready, authenticated]);

  useEffect(() => {
    if (!ready || !authenticated) return;

    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/vip/courses/public', { cache: 'no-store', credentials: 'include', headers });
        if (!res.ok) return;
        const data = await res.json();
        const courses = data.courses ?? [];
        setCourseIndicators({
          completed: courses.filter((course: { viewerProgressPct?: number }) => course.viewerProgressPct === 100).length,
          inProgress: courses.filter((course: { viewerProgressPct?: number }) => {
            const progress = course.viewerProgressPct ?? 0;
            return progress > 0 && progress < 100;
          }).length,
          saved: courses.length,
        });
      } catch { /* Keep the zero-state indicators visible. */ }
    })();
  }, [ready, authenticated, getAccessToken]);

  const loadMyGuides = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const [guidesRes, statsRes] = await Promise.all([
        fetch('/api/guides?mine=1', { cache: 'no-store', headers }),
        fetch('/api/guides/author-stats', { cache: 'no-store', headers }),
      ]);
      if (guidesRes.ok) {
        const data = await guidesRes.json();
        setMyGuides(data.guides ?? []);
      }
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setAuthorStats({
          totalAuthored: stats.totalAuthored,
          publishedCount: stats.publishedCount,
          totalLearnerCompletions: stats.totalLearnerCompletions,
          totalUpvotes: stats.totalUpvotes,
          totalDownvotes: stats.totalDownvotes,
        });
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

  useEffect(() => {
    if (!learnOnly || !ready || !authenticated) return;
    loadMyGuides();
  }, [learnOnly, ready, authenticated, loadMyGuides]);

  useEffect(() => onPersonalCourseUpdated(loadPersonalCourse), [loadPersonalCourse]);

  const guidesBySubject = (() => {
    const map = new Map<string, GuideRecord[]>();
    for (const g of guides) {
      const subjects = g.subjects.length > 0 ? g.subjects : ['General'];
      for (const s of subjects) {
        const list = map.get(s);
        if (list) list.push(g);
        else map.set(s, [g]);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  })();

  // Featured guides cycle through the full published set in groups of three.
  const featuredGroups = (() => {
    const groups: GuideRecord[][] = [];
    for (let i = 0; i < guides.length; i += 3) {
      groups.push(guides.slice(i, i + 3));
    }
    return groups;
  })();
  const featuredPageCount = featuredGroups.length;
  const activeFeaturedPage =
    featuredPageCount > 0 ? ((featuredPage % featuredPageCount) + featuredPageCount) % featuredPageCount : 0;
  const featuredGuides = featuredGroups[activeFeaturedPage] ?? [];

  return (
    <div className={`${styles.layout} ${learnOnly ? styles.learnLayout : ''}`}>
      <SideNavigation />
      <main className={styles.pageColumns}>
      <div className={styles.globalPanel}>
      <div className={styles.panelHeader}>
        <span className={styles.panelTitleJa}>知識</span>
        <span className={styles.panelTitle}>Academy</span>
      </div>
      {!learnOnly && (
      <section className={styles.dashboardHeader}>
        <div data-tour="home-profile">
          <ProfileDashboard />
        </div>
        <section className={styles.indicators} aria-label="Course indicators" onMouseEnter={() => play('soft-hover')}>
          <div className={styles.indicator}>
            <span className={styles.indicatorLabel}>Completed courses</span>
            <span className={styles.indicatorValue}>{courseIndicators.completed}</span>
          </div>
          <div className={styles.indicator}>
            <span className={styles.indicatorLabel}>In progress of study</span>
            <span className={styles.indicatorValue}>{courseIndicators.inProgress}</span>
          </div>
          <div className={styles.indicator}>
            <span className={styles.indicatorLabel}>Saved courses</span>
            <span className={styles.indicatorValue}>{courseIndicators.saved}</span>
          </div>
        </section>
        <div className={styles.dailyNotes} data-tour="daily-note">
          <DailyNotes enablePersistence={authenticated && ready} compact compactLabel="Daily Notes" />
          <button
            type="button"
            className={styles.fieldNotesGhost}
            onClick={() => setFieldNotesOpen(true)}
            disabled={!notebookEntriesUnlocked}
            title={notebookEntriesUnlocked ? undefined : 'Unlocks at 3,000 credits'}
          >
            <Image src="/icons/notebook-writing.svg" alt="" width={36} height={36} />
            <span>Notebook Entries</span>
          </button>
        </div>
      </section>
      )}
      {!learnOnly && (
        <div className={styles.folderSection} data-tour="home-courses">
        <FolderCardWrapper
          tabs={[
            {
              label: 'My Courses',
              content: (
                <section className={styles.folderRow} aria-label="Course folders">
                  <CourseFolderCard
                    title="Blue's Quest"
                    count={12}
                    href="/shadow-work"
                    avatarSrc="/blue/blue-home.png"
                    ctaDark
                    images={[]}
                  />
                  <CourseFolderCard
                    title="Course Library"
                    count={academyCourses.length}
                    href="/course"
                    avatarSrc="/academy-story.png"
                    dark
                    images={[]}
                  />
                  <CourseFolderCard
                    title="Your Course"
                    count={personalCourse ? 1 : 0}
                    href="/course/personal"
                    avatarSrc="/academic-angels.webp"
                    dark
                    images={[]}
                  />
                  <CourseFolderCard
                    title="Build a Course"
                    count={0}
                    href="/course-builder"
                    avatarSrc="/images/academy-blockchain.png"
                    dark
                    images={[]}
                  />
                </section>
              ),
            },
            { label: 'Lectures' },
            { label: 'Workshops' },
          ]}
        />
        </div>
      )}
      <div className={styles.main}>

        {!learnOnly && personalCourse && (
          <div className={styles.cardWrapper}>
          <Link href="/course/personal" className={styles.courseCard}>
            <span
              className={`${styles.thumb} ${styles.personalThumb}`}
              style={{ backgroundImage: `url('/uploads/course-personal.jpg')` }}
            >
              <div className={styles.badgeWrapper}>
                <div className={styles.cardBadgeGroup}>
                  <div className={styles.badgeSection}>
                    <span className={styles.badgeValue}>4 sessions</span>
                    <span className={styles.badgeEyebrow}>length</span>
                  </div>
                  <span className={styles.badgeDivider} />
                  <div className={styles.badgeSection}>
                    <span className={styles.badgeValue}>
                      <span className={styles.rewardStack}>
                        <Image src="/icons/usdc-logo.svg" alt="" width={18} height={18} className={styles.usdcIcon} />
                        <Image src="/icons/ui-diamond.svg" alt="" width={18} height={18} className={styles.diamondIcon} />
                      </span>
                    </span>
                    <span className={styles.badgeEyebrow}>rewards</span>
                  </div>
                </div>
              </div>
            </span>
            <div className={styles.body}>
              <span className={styles.category}>Your course</span>
              <div className={styles.contentCenter}>
                <span className={styles.title}>{personalCourse.title}</span>
                <span className={styles.desc}>
                  A personal 4-week track built around {personalCourse.focus.toLowerCase()} — a weekly read and tasks tuned to your goal.
                </span>
              </div>
              <div className={styles.cardFooter}>
                <span className={styles.cardMembership}>Free</span>
              </div>
              <div className={styles.progressDivider}>
                <div className={styles.progressFill} style={{ width: '0%' }} />
              </div>
            </div>
          </Link>
          </div>
        )}

        {!learnOnly && academyCourses.length > 0 && (
          <section className={styles.authoredSection}>
            <h2 className={styles.authoredHeading}>Academy courses</h2>
            <div className={styles.authoredList}>
              {academyCourses.map((c) => (
                <Link key={c.id} href={`/course/${c.slug}`} className={`${styles.authoredCard} ${styles.courseLink}`}>
                  <div className={styles.authoredBody}>
                    <span className={styles.authoredTitle}>{c.title}</span>
                    {c.tokenGate && (
                      <span className={styles.angelTag}>Academic Angels</span>
                    )}
                    {c.estimatedWeeks && (
                      <span className={styles.authoredSlug}>{c.estimatedWeeks} weeks</span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {learnOnly && (guides.length > 0 || (authenticated && (isVip || myGuides.length > 0))) && (
          <div className={styles.guideSection}>
            {guidesBySubject.length > 0 ? (
              <div className={styles.guideSectionToggle} role="group" aria-label="Guide layout">
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${guideView === 'list' ? styles.viewToggleBtnActive : ''}`}
                  aria-pressed={guideView === 'list'}
                  onClick={() => setGuideView('list')}
                >
                  <Rows size={15} weight="bold" /> List
                </button>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${guideView === 'card' ? styles.viewToggleBtnActive : ''}`}
                  aria-pressed={guideView === 'card'}
                  onClick={() => setGuideView('card')}
                >
                  <GridFour size={15} weight="bold" /> Cards
                </button>
                <button
                  type="button"
                  className={`${styles.viewToggleBtn} ${guideView === '3d' ? styles.viewToggleBtnActive : ''}`}
                  aria-pressed={guideView === '3d'}
                  onClick={() => setGuideView('3d')}
                >
                  <Cube size={15} weight="bold" /> 3D
                </button>
              </div>
            ) : (
              <h1 className={styles.guideSectionHeading}>Learn</h1>
            )}
            <div className={styles.guideSectionContent}>
              {guideProgress && authenticated && (
                <div className={styles.guideProgressCard}>
                  <div className={styles.guideProgressStats}>
                    <span className={styles.guideProgressStat}>
                      <span className={styles.guideProgressNum}>{guideProgress.completedGuides}</span>
                      <span className={styles.guideProgressLabel}>of {guideProgress.totalGuides} guides complete</span>
                    </span>
                    <span className={styles.guideProgressStat}>
                      <span className={styles.guideProgressNum}>{guideProgress.totalDiamondsEarned}</span>
                      <span className={styles.guideProgressLabel}>diamonds earned</span>
                    </span>
                  </div>
                  {guideProgress.totalGuides > 0 && (
                    <div className={styles.guideProgressTrack}>
                      <div
                        className={styles.guideProgressFill}
                        style={{ width: `${(guideProgress.completedGuides / guideProgress.totalGuides) * 100}%` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {featuredGuides.length > 0 && (
                <div className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>Popular topics</span>
                  <div className={styles.featuredRow}>
                    <div className={styles.featuredGrid}>
                    {featuredGuides.map((g) => (
                      <Link
                        key={`featured-${g.id}`}
                        href={`/learn/guides/${g.slug}`}
                        className={styles.featuredCard}
                        onMouseEnter={() => play('soft-hover')}
                      >
                        <span className={styles.featuredCardTitle}>{g.topicTitle}</span>
                        {g.summary && (
                          <span className={styles.featuredCardSummary}>{g.summary}</span>
                        )}
                      </Link>
                    ))}
                  </div>
                  {featuredPageCount > 1 && (
                    <div className={styles.featuredShuffle}>
                      <button
                        type="button"
                        className={styles.featuredShuffleBtn}
                        aria-label="Previous guides"
                        onClick={() => {
                          setFeaturedPage((p) => p - 1);
                          play('soft-hover');
                        }}
                      >
                        <CaretUp size={18} weight="bold" />
                      </button>
                      <span className={styles.featuredShufflePage}>
                        {activeFeaturedPage + 1}/{featuredPageCount}
                      </span>
                      <button
                        type="button"
                        className={styles.featuredShuffleBtn}
                        aria-label="More guides"
                        onClick={() => {
                          setFeaturedPage((p) => p + 1);
                          play('soft-hover');
                        }}
                      >
                        <CaretDown size={18} weight="bold" />
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}

              {guidesBySubject.length > 0 && (
                <div className={styles.guideViewBar}>
                  <span className={styles.guideSubjectLabel}>All guides</span>
                </div>
              )}

              {guidesBySubject.length > 0 && (
                <Link
                  href="/learn/guides/map"
                  className={styles.knowledgeTreeCard}
                  onMouseEnter={() => play('soft-hover')}
                >
                  <TreeStructure size={18} weight="bold" />
                  <span>See the knowledge tree</span>
                </Link>
              )}

              {guidesBySubject.map(([subject, subjectGuides]) => (
                <div key={subject} className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>{subject}</span>
                  <div
                    className={`${styles.guideCardList} ${
                      guideView === 'card'
                        ? styles.guideCardListCards
                        : guideView === '3d'
                          ? styles.guideCardList3d
                          : ''
                    }`}
                  >
                    {subjectGuides.map((g) => (
                      <Link
                        key={`${subject}-${g.id}`}
                        href={`/learn/guides/${g.slug}`}
                        className={`${styles.guideCard} ${guideView !== 'list' ? styles.guideCardTile : ''}`}
                        onMouseEnter={() => play('soft-hover')}
                      >
                        <div className={styles.guideCardBody}>
                          <span className={styles.guideCardTitle}>{g.topicTitle}</span>
                          {guideView !== 'list' && g.summary && (
                            <span className={styles.guideCardSummary}>{g.summary}</span>
                          )}
                        </div>
                        <span className={styles.guideCardChevron} aria-hidden="true">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}

              {authenticated && frontierGuides && frontierGuides.length > 0 && (
                <div className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>
                    {(guideProgress?.completedGuides ?? 0) === 0 ? 'Start here' : 'Next unlocks'}
                  </span>
                  <div className={styles.guideCardList}>
                    {frontierGuides.slice(0, 6).map((g) => (
                      <Link
                        key={`frontier-${g.id}`}
                        href={`/learn/guides/${g.slug}`}
                        className={styles.guideCard}
                        onMouseEnter={() => play('soft-hover')}
                      >
                        <div className={styles.guideCardBody}>
                          <span className={styles.guideCardTitle}>{g.topicTitle}</span>
                        </div>
                        <span className={styles.guideCardChevron} aria-hidden="true">›</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
              {authenticated &&
                frontierGuides &&
                frontierGuides.length === 0 &&
                guideProgress &&
                guideProgress.totalGuides > 0 &&
                guideProgress.completedGuides >= guideProgress.totalGuides && (
                  <p className={styles.guideAllDoneLine}>
                    You&apos;ve completed every guide here. Nice work.
                  </p>
                )}

              {authenticated && isVip && (
                <div className={styles.guideAuthorRow}>
                  <div className={styles.guideAuthorCopy}>
                    <span className={styles.guideAuthorTitle}>Author a guide</span>
                    <span className={styles.guideAuthorHint}>
                      Write the definitive guide for a topic, then submit it for verification.
                    </span>
                  </div>
                  <Link
                    href="/course-studio/guide/new"
                    className={styles.guideAuthorBtn}
                    onMouseEnter={() => play('soft-hover')}
                  >
                    <Plus size={14} weight="bold" /> New guide
                  </Link>
                </div>
              )}

              {myGuides.length > 0 && (
                <div className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>Your guides in progress</span>
                  <div className={styles.guideDraftGroup}>
                    {myGuides.map((g) => (
                      <div key={`mine-${g.id}`} className={styles.guideDraftCard}>
                        <span
                          className={`${styles.guideDraftStatus} ${g.status === 'pending_verification' ? styles.guideDraftStatusPending : ''}`}
                        >
                          {g.status === 'pending_verification' ? 'In review' : 'Draft'}
                        </span>
                        <Link
                          href={`/course-studio/guide/${g.slug}`}
                          className={styles.guideCard}
                          style={{ flex: 1 }}
                          onMouseEnter={() => play('soft-hover')}
                        >
                          <div className={styles.guideCardBody}>
                            <span className={styles.guideCardTitle}>{g.topicTitle}</span>
                          </div>
                          <span className={styles.guideCardChevron} aria-hidden="true">›</span>
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {authorStats && authorStats.totalAuthored > 0 && (
                <div className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>Author impact</span>
                  <div className={styles.authorStatsRow}>
                    <span className={styles.authorStat}>
                      <span className={styles.authorStatNum}>{authorStats.totalAuthored}</span>
                      <span className={styles.authorStatLabel}>authored</span>
                    </span>
                    <span className={styles.authorStatDivider} />
                    <span className={styles.authorStat}>
                      <span className={styles.authorStatNum}>{authorStats.publishedCount}</span>
                      <span className={styles.authorStatLabel}>published</span>
                    </span>
                    <span className={styles.authorStatDivider} />
                    <span className={styles.authorStat}>
                      <span className={styles.authorStatNum}>{authorStats.totalLearnerCompletions}</span>
                      <span className={styles.authorStatLabel}>learner completions</span>
                    </span>
                    {authorStats.totalUpvotes + authorStats.totalDownvotes > 0 && (
                      <>
                        <span className={styles.authorStatDivider} />
                        <span className={styles.authorStat}>
                          <span className={styles.authorStatNum}>{authorStats.totalUpvotes}</span>
                          <span className={styles.authorStatLabel}>upvotes</span>
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className={styles.guideSectionFooter}>guides & references</div>
          </div>
        )}

      </div>
      {!learnOnly && (
        <section className={styles.dashboardInsights} aria-label="Learning insights">
          <article className={styles.insightCard}>
            <h2 className={styles.insightTitle}>My Stats</h2>
            <div className={styles.statsChart} aria-label="Your field notes, missions, and balloons popped over the last 30 days">
              <StatsChart />
            </div>
          </article>

          <article className={styles.insightCard}>
            <div className={styles.planningHeader}>
              <h2 className={styles.insightTitle}>Planning</h2>
              <div className={styles.planningControls} aria-hidden="true">
                <span><CaretLeft size={16} weight="bold" /></span>
                <span><CaretRight size={16} weight="bold" /></span>
              </div>
            </div>
            <div className={styles.planningViewport} aria-label="Five-day calendar, focused on July 16 through 18">
              <div className={styles.planningDays}>
                <div className={styles.planningDayMuted}><span>Mon</span><strong>15</strong></div>
                <div className={`${styles.planningDay} ${styles.planningDayWarm}`}><span>Tue</span><strong>16</strong></div>
                <div className={`${styles.planningDay} ${styles.planningDayBlue}`}><span>Wed</span><strong>17</strong></div>
                <div className={`${styles.planningDay} ${styles.planningDayWarm}`}><span>Thu</span><strong>18</strong></div>
                <div className={styles.planningDayMuted}><span>Fri</span><strong>19</strong></div>
              </div>
              <div className={styles.planningTasks}>
                <span className={styles.planningTask}>Homework deadline</span>
                <span className={styles.planningTask}>Lecture: UI Kit&apos;s Guide</span>
                <span className={styles.planningTask}>Lesson: Figma</span>
              </div>
            </div>
          </article>
        </section>
      )}
      </div>
      </main>

      {!learnOnly && fieldNotesOpen && <FieldNotesSheet onClose={() => setFieldNotesOpen(false)} />}

      {!learnOnly && <FeatureTour />}

      {!learnOnly && (weeklyScript ? (
        <BlueDialogue
          open={weeklyOpen}
          placement="center"
          title={weeklyScript.title}
          subtitle={weeklyScript.subtitle}
          lines={weeklyScript.lines}
          emotion={weeklyScript.emotion}
          chatback={weeklyScript.chatback ? { placeholder: 'Answer Blue' } : undefined}
          onClose={handleWeeklyClose}
        />
      ) : (
        <BlueDialogue
          open={introOpen}
          lines={courseDialogue.lines}
          emotion={courseDialogue.emotion}
          onClose={handleIntroClose}
        />
      ))}

    </div>
  );
}
