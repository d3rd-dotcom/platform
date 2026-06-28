'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { Plus, PencilSimple, Sparkle } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CourseStudioModal from '@/components/course-studio/CourseStudioModal';
import type { CourseData } from '@/lib/personal-course';
import type { VipCourseRecord } from '@/lib/vip-course-db';
import type { ComponentType } from '@/lib/vip-course-db';
import { onPersonalCourseUpdated, personalCourseUrl } from '@/lib/personal-course-sync';
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

const COURSE_THUMB = 'https://i.imgur.com/KkpN9as.png';

export default function CoursesPage() {
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

  useEffect(() => {
    fetch('/api/users/lookup?username=Espeon')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user) setCoreAuthor({ username: d.user.username, avatarUrl: d.user.avatar_url });
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

        <div className={styles.divider} aria-hidden="true" />

        <Link href="/course" className={styles.courseCard}>
          <span
            className={styles.thumb}
            style={{ backgroundImage: `url(${JSON.stringify(COURSE_THUMB)})` }}
            aria-hidden="true"
          />
          <div className={styles.body}>
            <div className={styles.cardStats}>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>Length</span>
                <span className={styles.statValue}>12 wks</span>
              </div>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>Cost</span>
                <span className={styles.statValue}>Free</span>
              </div>
              <div className={styles.statGroup}>
                <span className={styles.statLabel}>Rewards</span>
                <span className={styles.statValue}>
                  12k
                  <img src="/icons/ui-diamond.svg" alt="" className={styles.diamondIcon} />
                </span>
              </div>
            </div>
            <div className={styles.progressDivider}>
              <div className={styles.progressFill} style={{ width: '8.3%' }} />
            </div>
            <div className={styles.contentCenter}>
              <span className={styles.title}>Creative Healing</span>
              <span className={styles.desc}>
                A journey through rediscovering your creative energy and excavating it to reach your highest horizon.
              </span>
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
          <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </Link>

        {personalCourse && (
          <Link href="/course/personal" className={styles.courseCard}>
            <span className={`${styles.thumb} ${styles.personalThumb}`} aria-hidden="true" />
            <div className={styles.body}>
              <span className={styles.category}>Your course</span>
              <div className={styles.cardStats}>
                <div className={styles.statGroup}>
                  <span className={styles.statLabel}>Length</span>
                  <span className={styles.statValue}>4 wks</span>
                </div>
                <div className={styles.statGroup}>
                  <span className={styles.statLabel}>Cost</span>
                  <span className={styles.statValue}>Free</span>
                </div>
                <div className={styles.statGroup}>
                  <span className={styles.statLabel}>Rewards</span>
                  <span className={styles.statValue}>
                    4k
                    <img src="/icons/ui-diamond.svg" alt="" className={styles.diamondIcon} />
                  </span>
                </div>
              </div>
              <div className={styles.progressDivider}>
                <div className={styles.progressFill} style={{ width: '0%' }} />
              </div>
              <div className={styles.contentCenter}>
                <span className={styles.title}>{personalCourse.title}</span>
                <span className={styles.desc}>
                  A personal 4-week track built around {personalCourse.focus.toLowerCase()} — a weekly read and tasks tuned to your goal.
                </span>
              </div>
            </div>
            <svg className={styles.arrow} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </Link>
        )}

        <section className={styles.aiSection}>
          <div className={styles.aiInputRow}>
            <input
              value={aiPrompt}
              onChange={(e) => { setAiPrompt(e.target.value); setGenError(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter' && !generating) handleGenerate(); }}
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
              <Sparkle size={16} weight="bold" />
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
