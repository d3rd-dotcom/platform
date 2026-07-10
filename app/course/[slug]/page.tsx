'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import Image from 'next/image';
import { CheckCircle, SealCheck, SpinnerGap, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import Banner from '@/components/banner/Banner';
import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import DiamondReward from '@/components/rewards/DiamondReward';
import type { CourseRecord, ChapterRecord, LessonRecord } from '@/lib/course-content-db';
import type { VipCourseFull, VipProgressRecord, CourseComponentRecord } from '@/lib/vip-course-db';
import styles from './page.module.css';
import courseStyles from '../page.module.css';

const ANGEL_IMAGE = 'https://i.imgur.com/KkpN9as.png';
const COMPLETION_REWARD = 50;
const SEAL_REWARD = 200;

const TASK_ACCENTS = ['#6C5CE7', '#F97316', '#22D3EE', '#F43F5E', '#A855F7', '#14B8A6', '#EAB308'];
const ARTWORK_VARIANTS = ['aurora', 'sunrise', 'orbit', 'bloom', 'ribbon', 'prism'];
const READING_ACCENT = '#6C5CE7';
const READING_THUMB_BG = 'linear-gradient(135deg, #6C5CE7 0%, #A855F7 50%, #C084FC 100%)';

type PageProps = { params: { slug: string } };

function getArtworkVariant(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = ((hash << 5) - hash) + id.charCodeAt(i);
  return ARTWORK_VARIANTS[Math.abs(hash) % ARTWORK_VARIANTS.length];
}

function getAllBlockIds(week: VipCourseFull['weeks'][number]): string[] {
  const ids: string[] = [];
  for (const comp of week.components) {
    // The Weekly Read has no complete action, so it can't gate the week seal
    if (comp.componentType === 'rich_text' && comp.title === 'Weekly Read') continue;
    if (comp.componentType === 'mission_container' && comp.blocks) {
      for (const block of comp.blocks) ids.push(block.id);
    } else {
      ids.push(comp.id);
    }
  }
  return ids;
}

export default function CourseSlugPage({ params }: PageProps) {
  const { ready, authenticated, user, getAccessToken, login } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const scrollRestored = useRef(false);

  useLayoutEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  // ── Academy course state ──
  const [course, setCourse] = useState<CourseRecord | null>(null);
  const [chapters, setChapters] = useState<Array<ChapterRecord & { lessons: LessonRecord[] }>>([]);
  const [accessGranted, setAccessGranted] = useState(false);
  const [gate, setGate] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [activeChapter, setActiveChapter] = useState<string | null>(null);

  // ── VIP course state ──
  const [vipCourse, setVipCourse] = useState<VipCourseFull | null>(null);
  const [activeWeek, setActiveWeek] = useState(1);
  const [progress, setProgress] = useState<VipProgressRecord[]>([]);
  const [sealing, setSealing] = useState(false);
  const [diamondReward, setDiamondReward] = useState<number | null>(null);
  const [rightContent, setRightContent] = useState<'reading' | null>(null);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<CourseComponentRecord | null>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  // On phones the Weekly Read panel stacks below the missions, so opening it
  // without scrolling to it reads as the tap doing nothing.
  useEffect(() => {
    if (isDesktop || rightContent !== 'reading') return;
    requestAnimationFrame(() => {
      rightPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [rightContent, isDesktop]);

  useEffect(() => {
    if (!scrollRestored.current && !loading && vipCourse) {
      scrollRestored.current = true;
      window.scrollTo(0, 0);
    }
  }, [loading, vipCourse]);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/course-content/${params.slug}`);
        if (res.ok) {
          const data = await res.json();
          setCourse(data.course);
          setChapters(data.chapters ?? []);
          if (data.chapters?.length > 0) setActiveChapter(data.chapters[0].id);
          const accessRes = await fetch(`/api/course-content/${params.slug}/access`);
          if (accessRes.ok) {
            const accessData = await accessRes.json();
            setAccessGranted(accessData.granted);
            setGate(accessData.gate || null);
          }
          setCheckingAccess(false);
          setLoading(false);
          return;
        }

        const headers = await authHeaders();
        const vipRes = await fetch(`/api/vip/courses/slug/${params.slug}`, { headers, credentials: 'include', cache: 'no-store' });
        if (vipRes.ok) {
          const vipData = await vipRes.json();
          const vc: VipCourseFull = vipData.course;
          if (vc.status !== 'published') {
            setNotFound(true);
            setLoading(false);
            return;
          }
          setVipCourse(vc);
          const progRes = await fetch(`/api/vip/courses/${vc.id}/progress`, { headers, credentials: 'include', cache: 'no-store' });
          if (progRes.ok) {
            const progData = await progRes.json();
            setProgress(progData.progress ?? []);
          }
          setLoading(false);
          return;
        }

        setNotFound(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [ready, params.slug, authHeaders]);

  const handleComplete = async (component: CourseComponentRecord) => {
    if (!vipCourse) return;
    const currentWeek = vipCourse.weeks.find((w) => w.weekNumber === activeWeek);
    if (!currentWeek) return;

    const blockIds: string[] = component.componentType === 'mission_container' && component.blocks
      ? component.blocks.map((b) => b.id)
      : [component.id];

    const wp = progress.find((p) => p.weekId === currentWeek.id);
    const newCompleted = [...new Set([...(wp?.completedComponentIds ?? []), ...blockIds])];
    const headers = await authHeaders();
    const res = await fetch(`/api/vip/courses/${vipCourse.id}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ weekId: currentWeek.id, completedComponentIds: newCompleted }),
    });
    if (res.ok) {
      const data = await res.json();
      setProgress((prev) => {
        const idx = prev.findIndex((p) => p.weekId === currentWeek.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = data.progress;
          return next;
        }
        return [...prev, data.progress];
      });
      const diamRes = await fetch(`/api/vip/courses/${vipCourse.id}/diamonds`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ componentId: component.id }),
      });
      if (diamRes.ok) {
        setDiamondReward(COMPLETION_REWARD);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      if (data?.error) window.alert(data.error);
    }
  };

  const handleSeal = async () => {
    // Reading is open to everyone; earning needs an account.
    if (!authenticated) {
      login();
      return;
    }
    if (!vipCourse || sealing) return;
    const currentWeek = vipCourse.weeks.find((w) => w.weekNumber === activeWeek);
    if (!currentWeek) return;
    setSealing(true);
    try {
      const headers = await authHeaders();
      const res = await fetch(`/api/vip/courses/${vipCourse.id}/seal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ weekId: currentWeek.id }),
      });
      if (res.ok) {
        setProgress((prev) => {
          const idx = prev.findIndex((p) => p.weekId === currentWeek.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], isSealed: true, sealedAt: new Date().toISOString() };
            return next;
          }
          return [...prev, {
            id: '', userId: '', courseId: vipCourse.id, weekId: currentWeek.id,
            completedComponentIds: [], componentData: {}, isSealed: true,
            sealedAt: new Date().toISOString(), createdAt: '', updatedAt: '',
          }];
        });
        setDiamondReward(SEAL_REWARD);
      }
    } catch { /* ignore */ }
    finally { setSealing(false); }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className={courseStyles.pageLayout}>
        <SideNavigation />
        <Banner />
        <main className={courseStyles.content}>
          <div className={styles.stateWrap}>
            <SpinnerGap size={24} className={styles.spinner} />
            <p className={styles.stateText}>Loading course…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── Not found ──
  if (notFound) {
    return (
      <div className={courseStyles.pageLayout}>
        <SideNavigation />
        <Banner />
        <main className={courseStyles.content}>
          <div className={styles.stateWrap}>
            <h1 className={styles.stateHeading}>Course not found</h1>
            <p className={styles.stateText}>This course doesn&apos;t exist or hasn&apos;t been published yet.</p>
            <Link href="/courses" className={styles.backBtn}>Back to courses</Link>
          </div>
        </main>
      </div>
    );
  }

  // ── VIP course view ──
  if (vipCourse) {
    const weeks = vipCourse.weeks.sort((a, b) => a.weekNumber - b.weekNumber);
    const currentWeek = weeks.find((w) => w.weekNumber === activeWeek) ?? weeks[0];
    const weekProgress = progress.find((p) => p.weekId === currentWeek?.id);
    const completedIds = new Set(weekProgress?.completedComponentIds ?? []);
    const allBlockIds = currentWeek ? getAllBlockIds(currentWeek) : [];
    const completedCount = allBlockIds.filter((id) => completedIds.has(id)).length;
    const totalCount = allBlockIds.length;
    const allDone = totalCount > 0 && completedCount === totalCount;
    const isSealed = weekProgress?.isSealed ?? false;
    const components = currentWeek?.components ?? [];
    const weekTitle = currentWeek?.title ?? '';
    const weekTheme = currentWeek?.theme ?? '';

    const readingComponent = components.find((c) => c.componentType === 'rich_text' && c.title === 'Weekly Read');
    const readingImageUrl = readingComponent ? (readingComponent.config as Record<string, string>)?.imageUrl ?? '' : '';
    const taskComponents = components.filter((c) => !(c.componentType === 'rich_text' && c.title === 'Weekly Read'));

    return (
      <div className={courseStyles.pageLayout}>
        <SideNavigation />
        <Banner
          backHref="/courses"
          breadcrumbs={[
            { label: 'Courses', href: '/courses' },
            { label: vipCourse.title || 'Custom course' },
            { label: `Week ${activeWeek}` },
          ]}
        />
        <main className={`${courseStyles.content} ${isDesktop ? courseStyles.contentDesktop : ''}`}>

          {diamondReward !== null && (
            <DiamondReward amount={diamondReward} onComplete={() => setDiamondReward(null)} />
          )}

          {/* ── Left column (Control Panel) ── */}
          <div className={isDesktop ? courseStyles.leftCol : undefined}>

           <div className={courseStyles.controlPanel}>

            {/* Banner */}
            <div
              className={courseStyles.panelBanner}
              style={vipCourse.coverImageUrl ? { backgroundImage: `url(${vipCourse.coverImageUrl})` } : undefined}
              aria-hidden="true"
            />

            <div className={courseStyles.panelBody}>

            {/* Blue avatar */}
            <div className={courseStyles.panelAvatarWrap}>
              <Image src="/blue/blue-home.png" alt="Blue" width={120} height={120} className={courseStyles.panelAvatar} />
            </div>

            {/* Title */}
            <div className={courseStyles.panelHeader}>
              <h1 className={courseStyles.panelTitle}>{vipCourse.title || 'Custom course'}</h1>
            </div>

            <div className={courseStyles.panelDivider} aria-hidden="true" />

            {/* Week navigation */}
            <div className={courseStyles.weekNav}>
              <button
                className={courseStyles.weekNavArrow}
                onClick={() => { const n = Math.max(1, activeWeek - 1); setActiveWeek(n); setRightContent(null); }}
                disabled={activeWeek <= 1}
                aria-label="Previous week"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>

              <div className={courseStyles.weekNavDots}>
                {weeks.map((w) => {
                  const wp = progress.find((p) => p.weekId === w.id);
                  const sealed = wp?.isSealed ?? false;
                  return (
                    <button
                      key={w.id}
                      className={`${courseStyles.weekDot} ${activeWeek === w.weekNumber ? courseStyles.weekDotActive : ''} ${sealed ? courseStyles.weekDotSealed : ''}`}
                      onClick={() => { setActiveWeek(w.weekNumber); setRightContent(null); }}
                      title={w.title || `Week ${w.weekNumber}`}
                    />
                  );
                })}
              </div>

              <button
                className={courseStyles.weekNavArrow}
                onClick={() => { const n = Math.min(weeks.length, activeWeek + 1); setActiveWeek(n); setRightContent(null); }}
                disabled={activeWeek >= weeks.length}
                aria-label="Next week"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            {/* Reading card */}
            {readingComponent && (
              <button
                type="button"
                className={`${courseStyles.readingCard} ${rightContent === 'reading' ? courseStyles.readingCardActive : ''}`}
                onClick={() => setRightContent('reading')}
              >
                <span className={courseStyles.readingAccent} style={{ background: READING_ACCENT }} aria-hidden="true" />
                <span className={courseStyles.readingThumb} style={{ background: READING_THUMB_BG }} aria-hidden="true">
                  {readingImageUrl && (
                    <Image src={readingImageUrl} alt="" fill sizes="64px" unoptimized className={courseStyles.readingThumbImg} />
                  )}
                </span>
                <div className={courseStyles.readingInfo}>
                  <span className={courseStyles.readingCategory}>{weekTheme || `Week ${activeWeek}`}</span>
                  <span className={courseStyles.readingTitle}>{weekTitle || 'Weekly Read'}</span>
                </div>
                <svg className={courseStyles.readingArrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            )}



            {/* Missions heading */}
            {taskComponents.length > 0 && (
              <div className={courseStyles.missionsHeadingRow} style={{ marginBottom: 12 }} aria-hidden="true">
                <span className={courseStyles.missionsDivider} />
                <h2 className={courseStyles.missionsHeading}>Missions</h2>
                <span className={courseStyles.missionsDivider} />
              </div>
            )}

            {/* Mission blocks — vertical accordion, expands in place */}
            <div className={styles.taskList}>
              {taskComponents.length === 0 && !readingComponent && (
                <p className={styles.emptyText}>No content in this week yet</p>
              )}
              {taskComponents.map((c, i) => {
                const accent = TASK_ACCENTS[i % TASK_ACCENTS.length];
                const variant = getArtworkVariant(c.id);
                const blockIds = c.componentType === 'mission_container' && c.blocks
                  ? c.blocks.map((b) => b.id)
                  : [c.id];
                const isComplete = blockIds.every((id) => completedIds.has(id));
                const isExpanded = expandedTaskId === c.id;

                return (
                  <div
                    key={c.id}
                    className={`${styles.taskCard} ${isExpanded ? styles.taskCardActive : ''} ${isComplete ? styles.taskCardComplete : ''}`}
                    style={{ '--task-accent': accent } as React.CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.detailCardHeader}
                      onClick={() => setExpandedTaskId((prev) => (prev === c.id ? null : c.id))}
                    >
                      <span className={styles.taskAccent} style={{ background: accent }} aria-hidden="true" />
                      <span
                        className={`${styles.taskArtwork} ${styles[`taskArtwork${variant.charAt(0).toUpperCase() + variant.slice(1)}`] || ''}`}
                        aria-hidden="true"
                      />
                      <span className={styles.taskTitle}>{c.title || 'Untitled'}</span>
                      <span className={styles.taskRight}>
                        {isComplete ? (
                          <span className={styles.taskCheckDone}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                        ) : (
                          <span className={styles.taskCheckEmpty} />
                        )}
                        <svg
                          className={`${styles.expandArrow} ${isExpanded ? styles.expandArrowOpen : ''}`}
                          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </span>
                    </button>

                    {isExpanded && (
                      <div className={styles.detailCardContent}>
                        <ComponentRenderer component={c} courseId={vipCourse.id} />
                        <div className={styles.detailActions}>
                          <button
                            type="button"
                            className={`${styles.completeBtn} ${isComplete ? styles.completeBtnDone : ''}`}
                            disabled={isComplete}
                            onClick={() => {
                              if (!authenticated) {
                                login();
                                return;
                              }
                              setPendingConfirm(c);
                            }}
                          >
                            {isComplete ? 'Task Complete' : `Complete task ◆ +${COMPLETION_REWARD}`}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Seal section */}
            {allDone && !isSealed && (
              <div className={styles.sealSection}>
                <button type="button" className={styles.sealBtn} onClick={handleSeal} disabled={sealing}>
                  {sealing ? 'Sealing...' : `Seal Week ${activeWeek} ◆ +${SEAL_REWARD}`}
                </button>
              </div>
            )}
            {isSealed && (
              <div className={styles.sealedSection}>
                <SealCheck size={20} weight="fill" />
                <span>Week {activeWeek} sealed</span>
              </div>
            )}
            </div>
           </div>
          </div>

          {/* ── Right panel (below the list on mobile) ── */}
          <div className={courseStyles.rightPanel} ref={rightPanelRef}>
            {rightContent === 'reading' && readingComponent && (
              <div className={courseStyles.popupCard}>
                <div className={courseStyles.inlineReaderInner}>
                  <button
                    type="button"
                    className={courseStyles.inlineReaderBack}
                    onClick={() => setRightContent(null)}
                  >
                    ← Back to missions
                  </button>
                  <div className={courseStyles.inlineReaderHeader}>
                    <span className={courseStyles.inlineReaderCategory}>{weekTheme || `Week ${activeWeek}`}</span>
                    <h2 className={courseStyles.inlineReaderTitle}>{weekTitle || 'Weekly Read'}</h2>
                  </div>
                  <div className={courseStyles.inlineReaderBody}>
                    <ComponentRenderer component={readingComponent} />
                  </div>
                </div>
              </div>
            )}

            {pendingConfirm && (
              <div className={styles.confirmOverlay} onClick={() => setPendingConfirm(null)}>
                <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
                  <div className={styles.confirmHeader}>
                    <span className={styles.confirmKanji}>任務記録</span>
                    <span className={styles.confirmTitle}>Mission Log</span>
                  </div>
                  <div className={styles.confirmBody}>
                    <p className={styles.confirmText}>
                      Completing a task is permanent — it can&apos;t be undone. Finish it and receive <strong>+{COMPLETION_REWARD} diamonds</strong>?
                    </p>
                  </div>
                  <div className={styles.confirmFooter}>
                    <button
                      className={styles.confirmBack}
                      onClick={() => setPendingConfirm(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className={styles.confirmSubmit}
                      onClick={() => {
                        if (pendingConfirm) handleComplete(pendingConfirm);
                        setPendingConfirm(null);
                      }}
                    >
                      Complete
                    </button>
                  </div>
                </div>
              </div>
            )}
            {!rightContent && <div />}
          </div>

        </main>
      </div>
    );
  }

  // ── Access check ──
  if (checkingAccess) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <Banner />
        <main className={styles.main}>
          <div className={styles.stateWrap}>
            <SpinnerGap size={24} className={styles.spinner} />
            <p className={styles.stateText}>Checking access…</p>
          </div>
        </main>
      </div>
    );
  }

  // ── NFT gate ──
  if (!accessGranted && gate) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <Banner />
        <main className={styles.main}>
          <div className={styles.gateCard}>
            <Image src={ANGEL_IMAGE} alt="" width={140} height={140} className={styles.gateImage} />
            <h1 className={styles.gateTitle}>Academic Angels only</h1>
            <p className={styles.gateDesc}>
              This course requires an <strong>Academic Angel NFT</strong>. Hold one to unlock access.
            </p>
            <Link href="/courses" className={styles.backBtn}>Back to courses</Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Academy course view ──
  return (
    <div className={styles.layout}>
      <SideNavigation />
      <Banner />
      <main className={styles.main}>
        <Link href="/courses" className={styles.backLink}>← Courses</Link>

        <div className={styles.courseHeader}>
          <h1 className={styles.courseTitle}>{course!.title}</h1>
          {course!.summary && <p className={styles.courseSummary}>{course!.summary}</p>}
          {course!.tokenGate && (
            <span className={styles.memberBadge}>Academic Angels</span>
          )}
        </div>

        {chapters.length === 0 ? (
          <div className={styles.stateWrap}>
            <p className={styles.stateText}>This course has no content yet.</p>
          </div>
        ) : (
          <div className={styles.chapterList}>
            {chapters.map((chapter) => (
              <div key={chapter.id} className={styles.chapterCard}>
                <button
                  type="button"
                  className={styles.chapterHeader}
                  onClick={() => setActiveChapter(activeChapter === chapter.id ? null : chapter.id)}
                >
                  <span className={styles.chapterTitle}>{chapter.title}</span>
                  <span className={styles.chapterToggle}>
                    {activeChapter === chapter.id ? '−' : '+'}
                  </span>
                </button>
                {activeChapter === chapter.id && chapter.lessons.length > 0 && (
                  <div className={styles.lessonList}>
                    {chapter.lessons.map((lesson) => (
                      <div key={lesson.id} className={styles.lessonItem}>
                        <span className={styles.lessonType}>{lesson.lessonType}</span>
                        <span className={styles.lessonTitle}>{lesson.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
