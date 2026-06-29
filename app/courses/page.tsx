'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Plus, PencilSimple } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CourseStudioModal from '@/components/course-studio/CourseStudioModal';
import type { CourseData } from '@/lib/personal-course';
import type { VipCourseRecord } from '@/lib/vip-course-db';
import type { ComponentType } from '@/lib/vip-course-db';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
import { useSound } from '@/hooks/useSound';
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

const COURSE_THUMB = '/academy-story.png';

export default function CoursesPage() {
  const { play } = useSound();
  const { ready, getAccessToken } = usePrivy();
  const [personalCourse, setPersonalCourse] = useState<CourseData | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [authoredCourses, setAuthoredCourses] = useState<VipCourseRecord[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [genCourse, setGenCourse] = useState<{
    title: string;
    focus: string;
    weeks: Array<{
      weekNumber: number;
      title: string;
      theme: string;
      components: Array<{
        componentType: string;
        title: string;
        config: Record<string, unknown>;
        required?: boolean;
      }>;
    }>;
  } | null>(null);
  const [coreAuthor, setCoreAuthor] = useState<{ username: string; avatarUrl: string | null } | null>(null);
  const [skyyeAuthor, setSkyyeAuthor] = useState<{ username: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    fetch('/api/users/lookup?username=Espeon')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user) setCoreAuthor({ username: d.user.username, avatarUrl: d.user.avatar_url });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/users/lookup?username=Skyye')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user) setSkyyeAuthor({ username: d.user.username, avatarUrl: d.user.avatar_url });
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

  useEffect(() => {
    if (!ready) return;
    loadPersonalCourse();
    loadAuthoredCourses();
  }, [ready, loadPersonalCourse]);

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

  const handleCourseCreated = useCallback(() => {
    setStudioOpen(false);
    setEditingCourseId(null);
    setGenCourse(null);
    setAiPrompt('');
    loadPersonalCourse();
    loadAuthoredCourses();
  }, [loadPersonalCourse, loadAuthoredCourses]);

  if (studioOpen || editingCourseId || genCourse) {
    return (
      <CourseStudioModal
        authHeaders={authHeaders}
        onClose={() => { setStudioOpen(false); setEditingCourseId(null); setGenCourse(null); setAiPrompt(''); }}
        onCourseCreated={handleCourseCreated}
        existingCourseId={editingCourseId ?? undefined}
        initialCourse={genCourse ?? undefined}
      />
    );
  }

  const handleGenerate = async () => {
    const trimmed = aiPrompt.trim();
    if (!trimmed) return;
    setGenerating(true);
    setGenError(null);
    try {
      const headers = await authHeaders();
      const res = await fetch('/api/vip/courses/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ prompt: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setGenCourse(data.course);
    } catch (err: any) {
      setGenError(err.message ?? 'Something went wrong');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.main}>

        <div className={styles.cardWrapper}>
          <Link href="/course" className={styles.courseCard}>
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
                    <div className={styles.cardMembers}>
                      <div className={styles.memberAvatars}>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #5168FF, #9b7ed9)' }}>AZ</span>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #FF7729, #F472B6)' }}>JM</span>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #74C465, #4ECDC4)' }}>KL</span>
                      </div>
                      <span className={styles.memberCount}>+23</span>
                    </div>
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
                  <div className={styles.progressFill} style={{ width: '8.3%' }} />
                </div>
              </div>
            </div>
          </Link>
        </div>

        <div className={styles.cardWrapper}>
          <Link href="/course/tap-into-creativity" className={styles.courseCard}>
            <div className={styles.cardHeader}>
              <span className={styles.cardKanji}>創造開拓</span>
              <span className={styles.cardHeaderTitle}>Tap Into Creativity</span>
            </div>
            <div className={styles.cardBodyRow}>
              <span
                className={styles.thumb}
                style={{ backgroundImage: `url('/uploads/tapinto-creativity.avif')` }}>
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
                <div className={styles.contentCenter}>
                  <span className={styles.desc}>
                    The goal is to help people feel confident and encouraged to express themselves creatively. It&apos;s the advice I wish I had when I was little and afraid to call myself an artist.
                  </span>
                </div>
                <div className={styles.cardFooter}>
                  <div className={styles.footerLeft}>
                    <div className={styles.cardMembers}>
                      <div className={styles.memberAvatars}>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #F472B6, #EC4899)' }}>AR</span>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #38BDF8, #818CF8)' }}>BN</span>
                        <span className={styles.memberAvatar} style={{ backgroundImage: 'linear-gradient(135deg, #FBBF24, #F59E0B)' }}>CL</span>
                      </div>
                      <span className={styles.memberCount}>+0</span>
                    </div>
                    <div className={styles.courseAuthor}>
                      <span
                        className={styles.authorAvatar}
                        style={skyyeAuthor?.avatarUrl ? { backgroundImage: `url(${JSON.stringify(skyyeAuthor.avatarUrl)})` } : { backgroundImage: 'linear-gradient(135deg, #8B5CF6, #F59E0B)' }}
                      >
                        {!skyyeAuthor?.avatarUrl ? (skyyeAuthor?.username?.[0] ?? 'S') : ''}
                      </span>
                      <span className={styles.authorName}>@{skyyeAuthor?.username ?? 'Skyye'}</span>
                    </div>
                  </div>
                  <span className={styles.cardMembership}>Academic Angels</span>
                </div>
                <div className={styles.progressDivider}>
                  <div className={styles.progressFill} style={{ width: '0%' }} />
                </div>
              </div>
            </div>
          </Link>
        </div>

        {personalCourse && (
          <div className={styles.cardWrapper}>
          <Link href="/course/personal" className={styles.courseCard}>
            <span className={`${styles.thumb} ${styles.personalThumb}`}>
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

        <section className={styles.aiSection}>
          <div className={styles.aiInputRow}>
            <input
              value={aiPrompt}
              onChange={(e) => { setAiPrompt(e.target.value); setGenError(null); }}
              onKeyDown={(e) => { play('click'); if (e.key === 'Enter' && !generating) handleGenerate(); }}
              placeholder="Describe your course."
              className={styles.aiInput}
              disabled={generating}
            />
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || !aiPrompt.trim()}
              className={styles.aiGenerateBtn}
            >
              {generating ? 'Building...' : 'Build With Blue'}
            </button>
          </div>
          {genError && <p className={styles.aiError}>{genError}</p>}
          {generating && (
            <div className={styles.aiGenerating}>
              <div className={styles.aiSpinner} />
              <span>Blue is designing your course...</span>
            </div>
          )}
        </section>

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
                  <button
                    type="button"
                    onClick={() => setEditingCourseId(c.id)}
                    className={styles.authoredEditBtn}
                    title="Edit course"
                  >
                    <PencilSimple size={16} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>
    </div>
  );
}
