'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePrivy } from '@privy-io/react-auth';
import { Plus } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import { scriptForWeek, WEEKLY_SEEN_KEY } from '@/components/daily-read/weeklyScripts';
import CourseFolderCard from '@/components/courses/CourseFolderCard';
import ProfileDashboard from '@/components/courses/ProfileDashboard';
import FieldNotesSheet from '@/components/courses/FieldNotesSheet';

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
    'I keep the Academy learning records. This page is where courses, guides, and field notes meet.',
    'Start with one guide, continue a course, or record an observation. I remember what you finish.',
    'Completing lessons and guides earns diamonds. Your progress unlocks the next branch.',
  ],
};

const DAILY_COURSES_DIALOGUES: CourseDialogue[] = [
  {
    emotion: 'calm',
    lines: [
      'One completed guide teaches me more than five open tabs.',
      'Choose the next node. Finish it, then follow the branch it unlocks.',
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
      'The knowledge tree maps dependencies.',
      'Clear the next prerequisite and the harder branch opens.',
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
  const [noteCount, setNoteCount] = useState(0);
  const [introOpen, setIntroOpen] = useState(false);
  const [courseDialogue, setCourseDialogue] = useState<CourseDialogue>(
    FIRST_COURSES_DIALOGUE,
  );
  const [weeklyWeek, setWeeklyWeek] = useState(0);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
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
    fetch('/api/guides?status=published')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.guides) setGuides(d.guides);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!ready || !authenticated) return;
    (async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/progress/stats', { cache: 'no-store', headers });
        if (res.ok) setGuideProgress(await res.json());
      } catch {}
    })();
  }, [ready, authenticated, getAccessToken]);

  useEffect(() => {
    if (!ready || !authenticated) return;
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
  }, [ready, authenticated, getAccessToken]);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

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

    fetch('/api/daily-notes/count', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setNoteCount(d?.count ?? 0))
      .catch(() => setNoteCount(0));
  }, [ready, authenticated]);

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
    if (!ready || !authenticated) return;
    loadMyGuides();
  }, [ready, authenticated, loadMyGuides]);

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

  const panelCourses = [
    { title: "Blue's Quest", href: '/shadow-work', progressPct: 0 },
    ...(personalCourse ? [{ title: personalCourse.title, href: '/course/personal', progressPct: 0 }] : []),
    ...academyCourses.map((c) => ({ title: c.title, href: `/course/${c.slug}`, progressPct: 0 })),
  ];

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.pageColumns}>
      <aside className={styles.aside}>
        <ProfileDashboard
          courses={panelCourses}
          noteCount={noteCount}
          onOpenNotes={() => setFieldNotesOpen(true)}
          questFolder={{ title: "Blue's Quest", count: 12, href: '/shadow-work' }}
        />
        <div className={styles.asideQuestFolder}>
          <CourseFolderCard
            title="Field Notes"
            count={noteCount}
            onOpen={() => setFieldNotesOpen(true)}
            ctaLabel="Open notes"
            dark
            images={[]}
          />
        </div>
      </aside>
      <div className={styles.main}>

        {personalCourse && (
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

        {academyCourses.length > 0 && (
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

        {(guides.length > 0 || (authenticated && (isVip || myGuides.length > 0))) && (
          <div className={styles.guideSection}>
            <h2 className={styles.guideSectionHeading}>Knowledge Base</h2>
            <div className={styles.guideSectionContent}>
              {authenticated && frontierGuides && frontierGuides.length > 0 && (
                <div className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>
                    {(guideProgress?.completedGuides ?? 0) === 0 ? 'Start here' : 'Next unlocks'}
                  </span>
                  <div className={styles.authoredList}>
                    {frontierGuides.slice(0, 6).map((g) => (
                      <Link
                        key={`frontier-${g.id}`}
                        href={`/home/guides/${g.slug}`}
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
              <Link
                href="/home/guides/map"
                className={styles.guideCard}
                onMouseEnter={() => play('soft-hover')}
              >
                <div className={styles.guideCardBody}>
                  <span className={styles.guideCardTitle}>See the knowledge map</span>
                </div>
                <span className={styles.guideCardChevron} aria-hidden="true">›</span>
              </Link>
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

              {guidesBySubject.map(([subject, subjectGuides]) => (
                <div key={subject} className={styles.guideSubjectGroup}>
                  <span className={styles.guideSubjectLabel}>{subject}</span>
                  <div className={styles.authoredList}>
                    {subjectGuides.map((g) => (
                      <Link
                        key={`${subject}-${g.id}`}
                        href={`/home/guides/${g.slug}`}
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
              ))}
            </div>
            <div className={styles.guideSectionFooter}>guides & references</div>
          </div>
        )}

      </div>
      </main>

      {fieldNotesOpen && <FieldNotesSheet onClose={() => setFieldNotesOpen(false)} />}

      {weeklyScript ? (
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
      )}

    </div>
  );
}
