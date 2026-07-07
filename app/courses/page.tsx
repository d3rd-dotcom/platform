'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { PencilSimple, Trash, Plus } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import BlueDialogue from '@/components/blue-dialogue/BlueDialogue';
import CourseFolderCard from '@/components/courses/CourseFolderCard';
import ProfileDashboard from '@/components/courses/ProfileDashboard';
import FieldNotesSheet from '@/components/courses/FieldNotesSheet';
import type { CourseData } from '@/lib/personal-course';
import type { VipCourseRecord } from '@/lib/vip-course-db';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
import type { CourseRecord } from '@/lib/course-content-db';
import type { GuideRecord, FrontierGuide } from '@/lib/guides-db';
import { useSound } from '@/hooks/useSound';
import { getStorageItem, setStorageItem } from '@/lib/safe-storage';
import styles from './page.module.css';

function getCourseEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 84);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getPersonalEndDate() {
  const d = new Date();
  d.setDate(d.getDate() + 28);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PublicCourseCard {
  id: string;
  slug: string;
  title: string;
  focus: string;
  coverImageUrl: string | null;
  authorName: string;
  authorAvatar: string | null;
  weekCount: number;
  totalTasks: number;
  memberCount: number;
  viewerCompletedTasks: number;
  viewerProgressPct: number;
}

export default function CoursesPage() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const [personalCourse, setPersonalCourse] = useState<CourseData | null>(null);
  const [authoredCourses, setAuthoredCourses] = useState<VipCourseRecord[]>([]);
  const [communityCourses, setCommunityCourses] = useState<PublicCourseCard[]>([]);
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [fieldNotesOpen, setFieldNotesOpen] = useState(false);
  const [noteCount, setNoteCount] = useState(0);
  const [introOpen, setIntroOpen] = useState(false);
  const { play } = useSound();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const seen = getStorageItem('mwa-courses-intro-seen');
    if (!seen) {
      const timer = setTimeout(() => setIntroOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleIntroClose = () => {
    setIntroOpen(false);
    setStorageItem('mwa-courses-intro-seen', 'true');
  };

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

  const loadCommunityCourses = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/vip/courses/public', { cache: 'no-store', headers });
      if (!res.ok) return;
      const data = await res.json();
      setCommunityCourses(data.courses ?? []);
    } catch { /* ignore */ }
  }, [authHeaders]);

  useEffect(() => {
    if (!ready) return;
    loadPersonalCourse();
    loadAuthoredCourses();
    loadCommunityCourses();
  }, [ready, loadPersonalCourse, loadCommunityCourses]);

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

  const loadAuthoredCourses = useCallback(async () => {
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/vip/courses', { cache: 'no-store', headers });
      if (!res.ok) return;
      const data = await res.json();
      setAuthoredCourses(data.courses ?? []);
    } catch { /* ignore */ }
  }, [authHeaders]);

  const confirmDelete = async () => {
    const id = deleteTarget;
    if (!id) return;
    setDeleting(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/vip/courses/${id}`, { method: 'DELETE', headers });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? 'Failed to delete course');
        setDeleting(false);
        setDeleteTarget(null);
        return;
      }
      setAuthoredCourses((prev) => prev.filter((c) => c.id !== id));
      setCommunityCourses((prev) => prev.filter((c) => c.id !== id));
      setDeleteTarget(null);
    } catch {
      alert('Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

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

  const shadowStats = communityCourses.find((c) => c.slug === 'creative-healing');
  const panelCourses = [
    { title: 'Shadow Work', href: '/shadow-work', progressPct: shadowStats?.viewerProgressPct ?? 0 },
    ...(personalCourse ? [{ title: personalCourse.title, href: '/course/personal', progressPct: 0 }] : []),
    ...communityCourses
      .filter((c) => c.slug !== 'creative-healing')
      .map((c) => ({ title: c.title, href: `/course/${c.slug}`, progressPct: c.viewerProgressPct })),
    ...academyCourses.map((c) => ({ title: c.title, href: `/course/${c.slug}`, progressPct: 0 })),
  ];

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.pageColumns}>
      <div className={styles.main}>

        <div className={styles.folderRow}>
          <CourseFolderCard
            title="Shadow Work"
            count={12}
            href="/shadow-work"
            images={[
              '/uploads/course-shadow-work.jpg',
              '/uploads/course-tap-creativity.jpg',
              '/uploads/course-personal.jpg',
              '/academy-story.png',
            ]}
          />
          <CourseFolderCard
            title="Your Field Notes"
            count={noteCount}
            onOpen={() => setFieldNotesOpen(true)}
            images={[]}
            ctaLabel="View Notes"
          />
        </div>

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
                        <img src="/icons/usdc-logo.svg" alt="" className={styles.usdcIcon} />
                        <img src="/icons/ui-diamond.svg" alt="" className={styles.diamondIcon} />
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

        {communityCourses.filter((c) => c.slug !== 'creative-healing').map((c) => (
          <div key={c.id} className={styles.cardWrapper}>
            <Link href={`/course/${c.slug}`} className={styles.courseCard}>
              <div className={styles.cardHeader}>
                <span className={styles.cardKanji}>友達</span>
                <span className={styles.cardHeaderTitle}>{c.title}</span>
              </div>
              <div className={styles.cardBodyRow}>
                <span
                  className={styles.thumb}
                  style={{ backgroundImage: `url(${JSON.stringify(c.coverImageUrl || '/academy-story.png')})` }}
                >
                  <div className={styles.badgeWrapper}>
                    <div className={styles.cardBadgeGroup}>
                      <div className={styles.badgeSection}>
                        <span className={styles.badgeValue}>{c.weekCount} {c.weekCount === 1 ? 'week' : 'weeks'}</span>
                        <span className={styles.badgeEyebrow}>length</span>
                      </div>
                      <span className={styles.badgeDivider} />
                      <div className={styles.badgeSection}>
                        <span className={styles.badgeValue}>{c.memberCount}</span>
                        <span className={styles.badgeEyebrow}>{c.memberCount === 1 ? 'member' : 'members'}</span>
                      </div>
                    </div>
                  </div>
                </span>
                <div className={styles.body}>
                  <div className={styles.contentCenter}>
                    <span className={styles.desc}>
                      {c.focus || 'A community course.'}
                    </span>
                  </div>
                  <div className={styles.cardFooter}>
                    <div className={styles.footerLeft}>
                      {c.authorName && (
                        <div className={styles.courseAuthor}>
                          <span
                            className={styles.authorAvatar}
                            style={c.authorAvatar ? { backgroundImage: `url(${JSON.stringify(c.authorAvatar)})` } : undefined}
                          >
                            {!c.authorAvatar ? c.authorName[0].toUpperCase() : ''}
                          </span>
                          <span className={styles.authorName}>@{c.authorName}</span>
                        </div>
                      )}
                    </div>
                    <span className={styles.cardMembership}>Free</span>
                  </div>
                  <div className={styles.progressDivider}>
                    <div className={styles.progressFill} style={{ width: `${c.viewerProgressPct}%` }} />
                  </div>
                </div>
              </div>
            </Link>
          </div>
        ))}

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

        {authoredCourses.length > 0 && (
          <section className={styles.authoredSection}>
            <h2 className={styles.authoredHeading}>Your authored courses</h2>
            <div className={styles.authoredList}>
              {authoredCourses.map((c) => (
                <div key={c.id} className={styles.authoredCard}>
                  <div className={styles.authoredBody}>
                    <span className={styles.authoredTitle}>{c.title}</span>
                    <span className={styles.authoredSlug}>/{c.slug}</span>
                    <span className={`${styles.authoredStatus} ${c.status === 'published' ? styles.authoredStatusPublished : ''}`}>
                      {c.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    {c.authorName && (
                      <div className={styles.courseAuthor}>
                        <span
                          className={styles.authorAvatar}
                          style={c.authorAvatar ? { backgroundImage: `url(${JSON.stringify(c.authorAvatar)})` } : undefined}
                        >
                          {!c.authorAvatar ? c.authorName[0].toUpperCase() : ''}
                        </span>
                        <span className={styles.authorName}>@{c.authorName}</span>
                      </div>
                    )}
                  </div>
                  <div className={styles.authoredActions}>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(c.id)}
                      className={styles.authoredDeleteBtn}
                      title="Delete course"
                    >
                      <Trash size={16} weight="bold" />
                    </button>
                    <Link
                      href={`/course-builder?edit=${c.id}`}
                      className={styles.authoredEditBtn}
                      title="Edit course"
                    >
                      <PencilSimple size={16} weight="bold" />
                    </Link>
                  </div>
                </div>
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
                        href={`/courses/guides/${g.slug}`}
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
                href="/courses/guides/map"
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
                        href={`/courses/guides/${g.slug}`}
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

      <aside className={styles.aside}>
        <ProfileDashboard courses={panelCourses} />
      </aside>
      </main>

      {fieldNotesOpen && <FieldNotesSheet onClose={() => setFieldNotesOpen(false)} />}

      <BlueDialogue
        open={introOpen}
        lines={[
          "Hey, welcome to the Mental Wealth Academy learning hub!",
          "You'll find a lot of guides made by our community on many topics. You can start from level-1 or skip.",
          "You earn diamonds ($BLUE) for each level. The more Blue Diamonds you hold, the more Blue Bitcoin you'll accumulate.",
          "Continue exploring and contributing to the platform to earn.",
        ]}
        emotion="happy"
        onClose={handleIntroClose}
      />

      {deleteTarget && (
        <div className={styles.deleteOverlay} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={styles.deleteDialog} onClick={(e) => e.stopPropagation()}>
            <div className={styles.deleteTitleBar}>
              <span className={styles.deleteTitleText}>delete.course</span>
            </div>
            <div className={styles.deleteBody}>
              <div className={styles.deleteIcon}>
                <Trash size={28} weight="bold" />
              </div>
              <p className={styles.deleteMessage}>
                Are you sure you want to delete this course? This cannot be undone.
              </p>
              <div className={styles.deleteButtons}>
                <button
                  type="button"
                  className={styles.deleteBtnCancel}
                  disabled={deleting}
                  onClick={() => setDeleteTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.deleteBtnConfirm}
                  disabled={deleting}
                  onClick={confirmDelete}
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
