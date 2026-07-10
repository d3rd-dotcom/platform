'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Circle,
  Clock,
  GraduationCap,
  RocketLaunch,
  TreeStructure,
  UsersThree,
  X,
} from '@phosphor-icons/react';
import { usePrivy } from '@privy-io/react-auth';
import { useSound } from '@/hooks/useSound';
import { useScrollLock } from '@/hooks/useScrollLock';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import GuideBody from '@/components/guides/GuideBody';
import GuideMethods from '@/components/guides/GuideMethods';
import GuideWalkthrough from '@/components/guides/GuideWalkthrough';
import BlueGuideCompanion from '@/components/guides/BlueGuideCompanion';
import GuideVoteBar from '@/components/guides/GuideVoteBar';
import VerificationLog from '@/components/guides/VerificationLog';
import DisputeSection from '@/components/guides/DisputeSection';
import GuideMaterials from '@/components/guides/GuideMaterials';
import type { GuideMaterial } from '@/lib/guide-materials-db';
import type { GuideRecord, GuideMethodRecord, GuideLink } from '@/lib/guides-db';
import { getWellbeingDomain } from '@/lib/wellbeing-domains';
import styles from './page.module.css';

type PageProps = { params: { slug: string } };

interface GuidePayload {
  guide: GuideRecord;
  methods: GuideMethodRecord[];
  prereqs: GuideLink[];
  dependents: GuideLink[];
  level?: number;
}

function formatReviewedDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00Z`));
}

function WalkthroughOverlay({ slug, onClose }: { slug: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useScrollLock(mounted);

  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mounted, onClose]);

  if (!mounted || typeof document === 'undefined' || !document.body) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={styles.overlayModal} role="dialog" aria-modal="true" aria-label="Walkthrough">
        <div className={styles.overlayHeader}>
          <h2 className={styles.overlayTitle}>
            <GraduationCap size={18} weight="bold" />
            Walkthrough
          </h2>
          <button type="button" className={styles.overlayClose} onClick={onClose} aria-label="Close walkthrough">
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className={styles.overlayBody}>
          <GuideWalkthrough slug={slug} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function GuidePage({ params }: PageProps) {
  const { ready, getAccessToken } = usePrivy();
  const { play } = useSound();
  const [data, setData] = useState<GuidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [materials, setMaterials] = useState<GuideMaterial[]>([]);

  useEffect(() => {
    fetch(`/api/guides/${params.slug}/materials`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.materials) setMaterials(d.materials);
      })
      .catch(() => {});
  }, [params.slug]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/guides/${params.slug}`, { cache: 'no-store', headers });
      if (!res.ok) {
        setNotFound(true);
        return;
      }
      setData(await res.json());
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [params.slug, getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.page}>
        {loading && <div className={styles.state}>Loading guide…</div>}
        {notFound && !loading && <div className={styles.state}>Guide not found.</div>}

        {data && !loading && (
          <>
            <header className={styles.header}>
              <Link href="/home" className={styles.back}>
                <ArrowLeft size={16} weight="bold" /> Knowledge Base
              </Link>
              <div className={styles.subjects}>
                {data.guide.subjects.map((s) => {
                  const domain = getWellbeingDomain(s);
                  return (
                    <span key={s} className={styles.subjectTag} title={domain ? domain.blurb : undefined}>
                      {s}
                    </span>
                  );
                })}
                {typeof data.level === 'number' && (
                  <span className={styles.levelChip}>Depth {data.level}</span>
                )}
                <button
                  type="button"
                  className={styles.walkthroughTrigger}
                  onMouseEnter={() => play('soft-hover')}
                  onClick={() => {
                    play('click');
                    setShowWalkthrough(true);
                  }}
                >
                  <GraduationCap size={14} weight="bold" />
                  Walkthrough
                </button>
              </div>
              <h1 className={styles.title}>{data.guide.topicTitle}</h1>
              {data.guide.summary && (
                <p className={styles.topicSummary}>{data.guide.summary}</p>
              )}
              {(data.guide.estimatedMinutes || data.guide.intendedAudience) && (
                <div className={styles.topicMeta}>
                  {data.guide.estimatedMinutes && (
                    <span className={styles.topicMetaItem}>
                      <Clock size={15} weight="bold" />
                      {data.guide.estimatedMinutes} min
                    </span>
                  )}
                  {data.guide.intendedAudience && (
                    <span className={styles.topicMetaItem}>
                      <UsersThree size={15} weight="bold" />
                      {data.guide.intendedAudience}
                    </span>
                  )}
                </div>
              )}
            </header>

            <BlueGuideCompanion guide={data.guide} prereqs={data.prereqs} />

            {data.prereqs.length > 0 && (
              <section className={styles.relSection}>
                <h2 className={styles.relHeading}>
                  <TreeStructure size={16} weight="duotone" className={styles.relIcon} />
                  Prerequisites
                </h2>
                <div className={styles.chips}>
                  {data.prereqs.map((p) => (
                    <Link
                      key={p.id}
                      href={`/home/guides/${p.slug}`}
                      className={styles.chip}
                      onMouseEnter={() => play('soft-hover')}
                      onClick={() => play('navigation')}
                    >
                      {p.topicTitle}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {data.guide.evidenceCriteria.length > 0 && (
              <section className={styles.criteria} aria-label="What you will be able to do">
                <span className={styles.criteriaLabel}>{"What you'll be able to do"}</span>
                <ul className={styles.criteriaList}>
                  {data.guide.evidenceCriteria.map((c, i) => (
                    <li key={i} className={styles.criteriaItem}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            <div className={styles.divider}>
              <span className={styles.dividerRule} />
              <Circle size={8} weight="fill" className={styles.dividerIcon} />
              <span className={styles.dividerRule} />
            </div>

            <article className={styles.content}>
              <GuideBody body={data.guide.body} topicTitle={data.guide.topicTitle} />
            </article>

            <div className={styles.voteRow}>
              <GuideVoteBar
                slug={data.guide.slug}
                sectionTitles={
                  Array.isArray(data.guide.body)
                    ? data.guide.body
                        .map((c) => (typeof c?.title === 'string' ? c.title : ''))
                        .filter(Boolean)
                    : []
                }
              />
            </div>

            <GuideMethods methods={data.methods} />

            <GuideMaterials materials={materials} />

            {(data.guide.sourceProvenance || data.guide.sourceReviewedAt) && (
              <section className={styles.sourceSection}>
                <h2 className={styles.relHeading}>
                  <BookOpenText size={16} weight="duotone" className={styles.relIcon} />
                  Source record
                </h2>
                {data.guide.sourceProvenance && (
                  <p className={styles.sourceText}>{data.guide.sourceProvenance}</p>
                )}
                {data.guide.sourceReviewedAt && (
                  <p className={styles.sourceDate}>
                    Sources reviewed {formatReviewedDate(data.guide.sourceReviewedAt)}
                  </p>
                )}
              </section>
            )}

            {data.dependents.length > 0 && (
              <section className={styles.relSection}>
                <h2 className={styles.relHeading}>
                  <RocketLaunch size={16} weight="duotone" className={styles.relIcon} />
                  Builds toward
                </h2>
                <div className={styles.chips}>
                  {data.dependents.map((d) => (
                    <Link
                      key={d.id}
                      href={`/home/guides/${d.slug}`}
                      className={styles.chipNext}
                      onMouseEnter={() => play('soft-hover')}
                      onClick={() => play('navigation')}
                    >
                      {d.topicTitle} <ArrowRight size={13} weight="bold" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <VerificationLog guideId={data.guide.id} />

            <DisputeSection guideId={data.guide.id} />

            {showWalkthrough && (
              <WalkthroughOverlay
                slug={data.guide.slug}
                onClose={() => setShowWalkthrough(false)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
