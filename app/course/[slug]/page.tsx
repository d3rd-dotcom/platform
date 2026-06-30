'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import Link from 'next/link';
import { CheckCircle, SealCheck, SpinnerGap, ArrowLeft, ArrowRight } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import ComponentRenderer from '@/components/course-renderers/ComponentRenderer';
import type { CourseRecord, ChapterRecord, LessonRecord } from '@/lib/course-content-db';
import type { VipCourseFull, VipProgressRecord } from '@/lib/vip-course-db';
import styles from './page.module.css';

const ANGEL_IMAGE = 'https://i.imgur.com/KkpN9as.png';
const COMPLETION_REWARD = 50;
const SEAL_REWARD = 200;

type PageProps = { params: { slug: string } };

function getAllComponentIds(week: VipCourseFull['weeks'][number]): string[] {
  const ids: string[] = [];
  for (const comp of week.components) {
    if (comp.componentType === 'mission_container' && comp.blocks) {
      for (const block of comp.blocks) ids.push(block.id);
    } else {
      ids.push(comp.id);
    }
  }
  return ids;
}

export default function CourseSlugPage({ params }: PageProps) {
  const { ready, authenticated, user, getAccessToken } = usePrivy();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
  const [shardAnim, setShardAnim] = useState<number | null>(null);

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
        const vipRes = await fetch(`/api/vip/courses/slug/${params.slug}`, { headers });
        if (vipRes.ok) {
          const vipData = await vipRes.json();
          const vc: VipCourseFull = vipData.course;
          if (vc.status !== 'published') {
            setNotFound(true);
            setLoading(false);
            return;
          }
          setVipCourse(vc);
          const progRes = await fetch(`/api/vip/courses/${vc.id}/progress`, { headers });
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

  const handleComplete = async (componentId: string) => {
    if (!vipCourse) return;
    const currentWeek = vipCourse.weeks.find((w) => w.weekNumber === activeWeek);
    if (!currentWeek) return;
    const wp = progress.find((p) => p.weekId === currentWeek.id);
    const newCompleted = [...(wp?.completedComponentIds ?? []), componentId];
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
        body: JSON.stringify({ componentId }),
      });
      if (diamRes.ok) {
        setShardAnim(COMPLETION_REWARD);
        setTimeout(() => setShardAnim(null), 2000);
      }
    }
  };

  const handleSeal = async () => {
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
        setShardAnim(SEAL_REWARD);
        setTimeout(() => setShardAnim(null), 3000);
      }
    } catch { /* ignore */ }
    finally { setSealing(false); }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
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
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
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
    const allComponentIds = currentWeek ? getAllComponentIds(currentWeek) : [];
    const completedCount = allComponentIds.filter((id) => completedIds.has(id)).length;
    const totalCount = allComponentIds.length;
    const allDone = totalCount > 0 && completedCount === totalCount;
    const isSealed = weekProgress?.isSealed ?? false;

    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          {shardAnim !== null && (
            <div className={styles.shardToast}>
              <span className={styles.shardIcon}>◆</span>
              +{shardAnim} diamonds
            </div>
          )}

          <Link href="/courses" className={styles.backLink}>← Courses</Link>

          <div className={styles.courseHeader}>
            <h1 className={styles.courseTitle}>{vipCourse.title}</h1>
            {vipCourse.focus && <p className={styles.courseSummary}>{vipCourse.focus}</p>}
            <div className={styles.courseMeta}>
              <span>by @{vipCourse.authorName}</span>
              <span>{weeks.length} sessions</span>
            </div>
          </div>

          <div className={styles.weekNav}>
            <button type="button" className={styles.weekArrow} onClick={() => setActiveWeek(Math.max(1, activeWeek - 1))} disabled={activeWeek <= 1}>
              <ArrowLeft size={14} weight="bold" />
            </button>
            <div className={styles.weekDots}>
              {weeks.map((w) => {
                const wp = progress.find((p) => p.weekId === w.id);
                const sealed = wp?.isSealed ?? false;
                return (
                  <button
                    key={w.id}
                    type="button"
                    className={`${styles.weekDot} ${activeWeek === w.weekNumber ? styles.weekDotActive : ''} ${sealed ? styles.weekDotSealed : ''}`}
                    onClick={() => setActiveWeek(w.weekNumber)}
                    title={w.title || `Week ${w.weekNumber}`}
                  />
                );
              })}
            </div>
            <button type="button" className={styles.weekArrow} onClick={() => setActiveWeek(Math.min(weeks.length, activeWeek + 1))} disabled={activeWeek >= weeks.length}>
              <ArrowRight size={14} weight="bold" />
            </button>
          </div>

          {currentWeek && (
            <div className={styles.weekContent}>
              <div className={styles.weekHeader}>
                <div>
                  <h2 className={styles.weekTitle}>{currentWeek.title || `Week ${currentWeek.weekNumber}`}</h2>
                  {currentWeek.theme && <p className={styles.weekTheme}>{currentWeek.theme}</p>}
                </div>
                <div className={styles.weekProgress}>
                  {isSealed ? (
                    <span className={styles.sealedBadge}>
                      <SealCheck size={14} weight="fill" />
                      Sealed
                    </span>
                  ) : (
                    <span className={styles.progressCount}>{completedCount}/{totalCount}</span>
                  )}
                </div>
              </div>

              <div className={styles.componentsList}>
                {currentWeek.components.map((component) => {
                  if (component.componentType === 'mission_container' && component.blocks) {
                    return component.blocks.map((block) => {
                      const blockAsComponent = {
                        ...component,
                        componentType: block.blockType,
                        config: block.config,
                        title: '',
                        blocks: [],
                      } as any;
                      const isComplete = completedIds.has(block.id);
                      return (
                        <div key={block.id} className={`${styles.componentCard} ${isComplete ? styles.componentComplete : ''}`}>
                          {!isComplete && (
                            <div className={styles.componentActions}>
                              <button type="button" className={styles.completeBtn} onClick={() => handleComplete(block.id)}>
                                Mark complete
                              </button>
                            </div>
                          )}
                          {isComplete && <CheckCircle size={16} weight="fill" className={styles.checkIcon} />}
                          <ComponentRenderer component={blockAsComponent} />
                        </div>
                      );
                    });
                  }
                  const compId = component.id;
                  const isComplete = completedIds.has(compId);
                  return (
                    <div key={compId} className={`${styles.componentCard} ${isComplete ? styles.componentComplete : ''}`}>
                      {component.title && <h3 className={styles.componentTitle}>{component.title}</h3>}
                      <ComponentRenderer component={component} />
                      {isComplete && <CheckCircle size={16} weight="fill" className={styles.checkIcon} />}
                      {!isComplete && (
                        <button type="button" className={styles.completeBtn} onClick={() => handleComplete(compId)}>
                          Mark complete
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {!isSealed && allDone && (
                <div className={styles.sealSection}>
                  <button type="button" className={styles.sealBtn} onClick={handleSeal} disabled={sealing}>
                    {sealing ? 'Sealing...' : `Seal Week ${currentWeek.weekNumber} ◆ +${SEAL_REWARD}`}
                  </button>
                </div>
              )}

              {isSealed && (
                <div className={styles.sealedSection}>
                  <SealCheck size={20} weight="fill" />
                  <span>Week {currentWeek.weekNumber} sealed</span>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ── Access check ──
  if (checkingAccess) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.stateWrap}>
            <SpinnerGap size={24} className={styles.spinner} />
            <p className={styles.stateText}>Checking access…</p>
          </div>
        </main>
      </div>
    );
  }

  if (!accessGranted && gate) {
    return (
      <div className={styles.layout}>
        <SideNavigation />
        <main className={styles.main}>
          <div className={styles.gateCard}>
            <img src={ANGEL_IMAGE} alt="" className={styles.gateImage} />
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
