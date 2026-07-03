'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import type { CourseData } from '@/lib/personal-course';
import type { VipCourseRecord } from '@/lib/vip-course-db';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
import type { CourseRecord } from '@/lib/course-content-db';
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

const COURSE_THUMB = '/uploads/course-shadow-work.jpg';

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
  const [coreAuthor, setCoreAuthor] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const [academyCourses, setAcademyCourses] = useState<CourseRecord[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [isVip, setIsVip] = useState(false);

  useEffect(() => {
    fetch('/api/users/lookup?username=Espeon')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user) setCoreAuthor({ username: d.user.username, avatarUrl: d.user.avatar_url });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/course-content')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.courses) setAcademyCourses(d.courses);
      })
      .catch(() => {});
  }, []);

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
  }, [ready, authenticated]);

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

  const shadowStats = communityCourses.find((c) => c.slug === 'creative-healing');

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>

        <div className={styles.cardWrapper}>
          <Link href="/shadow-work" className={styles.courseCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardKanji}>影の探求</span>
              <span className={styles.cardHeaderTitle}>Shadow Work Course</span>
            </div>
            <div className={styles.cardBodyRow}>
              <span
                className={styles.thumb}
                style={{ backgroundImage: `url(${JSON.stringify(COURSE_THUMB)})` }}
              >
                <div className={styles.badgeWrapper}>
                  <div className={styles.cardBadgeGroup}>
                    <div className={styles.badgeSection}>
                      <span className={styles.badgeValue}>12 sessions</span>
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
                <div className={styles.contentCenter}>
                  <span className={styles.desc}>
                    A journey through rediscovering your creative energy and excavating it to reach your highest horizon.
                  </span>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.footerLeft}>
                    {shadowStats && (
                      <div className={styles.cardMembers}>
                        <span className={styles.memberCount}>
                          {shadowStats.memberCount} {shadowStats.memberCount === 1 ? 'member' : 'members'}
                        </span>
                      </div>
                    )}
                    <div className={styles.courseAuthor}>
                      <span
                        className={styles.authorAvatar}
                        style={coreAuthor?.avatarUrl ? { backgroundImage: `url(${JSON.stringify(coreAuthor.avatarUrl)})` } : undefined}
                      >
                        {!coreAuthor?.avatarUrl ? (coreAuthor?.username?.[0] ?? 'E') : ''}
                      </span>
                      <span className={styles.authorName}>@{coreAuthor?.username ?? 'Espeon'}</span>
                    </div>
                  </div>
                  <span className={styles.cardMembership}>Free</span>
                </div>
                <div className={styles.progressDivider}>
                  <div className={styles.progressFill} style={{ width: `${shadowStats?.viewerProgressPct ?? 0}%` }} />
                </div>
              </div>
            </div>
          </Link>
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
                <span className={styles.cardKanji}>/{c.slug}</span>
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

        {authenticated && isVip && (
          <Link href="/course-builder" className={styles.createCourseBtn}>
            <span className={styles.createCourseIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <span className={styles.createCourseLabel}>Create Course</span>
          </Link>
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

      </main>

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
