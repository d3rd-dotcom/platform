'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle,
  GraduationCap,
  LockKey,
  PencilSimple,
  RocketLaunch,
  TreeStructure,
  X,
} from '@phosphor-icons/react';
import { usePrivy } from '@privy-io/react-auth';
import { useSound } from '@/hooks/useSound';
import { useScrollLock } from '@/hooks/useScrollLock';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CtaButton from '@/components/shared/CtaButton';
import DiamondReward from '@/components/rewards/DiamondReward';
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
  completeReward?: number;
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
          <span className={styles.overlayIconBadge}>
            <GraduationCap size={20} weight="duotone" />
          </span>
          <div className={styles.overlayTitleGroup}>
            <h2 className={styles.overlayTitle}>Walkthrough</h2>
          </div>
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
  const { ready, authenticated, getAccessToken, login } = usePrivy();
  const { play } = useSound();
  const [data, setData] = useState<GuidePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showWalkthrough, setShowWalkthrough] = useState(false);
  const [materials, setMaterials] = useState<GuideMaterial[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string> | null>(null);
  const [progressResolved, setProgressResolved] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [rewardDiamonds, setRewardDiamonds] = useState(0);
  const [showDiamondReward, setShowDiamondReward] = useState(false);

  // The viewer's completed guide ids gate the reading content: a higher-level
  // topic stays locked until its prerequisites are cleared. Signed-out readers
  // have no progress, so a topic with prerequisites reads as locked for them.
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      setCompletedIds(null);
      setProgressResolved(true);
      return;
    }
    let cancelled = false;
    setProgressResolved(false);
    (async () => {
      try {
        const token = await getAccessToken().catch(() => null);
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await fetch('/api/guides/progress', { cache: 'no-store', headers });
        if (res.ok) {
          const json = (await res.json()) as { completedGuideIds?: string[] };
          if (!cancelled) setCompletedIds(new Set(json.completedGuideIds ?? []));
        }
      } catch {
        /* soft-fail: treat as no progress, which locks gated topics */
      } finally {
        if (!cancelled) setProgressResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken]);

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

  const isCompleted = !!data && !!completedIds?.has(data.guide.id);

  // Mark this guide complete — the same server-gated, idempotent path the
  // walkthrough uses (prereq gate 409s server-side; rewards pay once, ever).
  const handleComplete = useCallback(async () => {
    if (!data) return;
    if (!authenticated) {
      login();
      return;
    }
    setCompleting(true);
    setCompleteError(null);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const res = await fetch('/api/guides/progress', {
        method: 'POST',
        headers,
        body: JSON.stringify({ guideId: data.guide.id }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        play('error');
        setCompleteError(body.error ?? 'Could not complete this guide.');
        return;
      }
      setCompletedIds((prev) => new Set(prev ?? []).add(data.guide.id));
      if (typeof body.diamonds === 'number' && body.diamonds > 0) {
        play('celebration');
        setRewardDiamonds(body.diamonds);
        setShowDiamondReward(true);
      } else {
        play('success');
      }
    } finally {
      setCompleting(false);
    }
  }, [data, authenticated, login, getAccessToken, play]);

  // A prerequisite counts as met only for a signed-in viewer who has completed
  // it. Everything the reader still needs to clear gates the guide body below.
  const missingPrereqs = data
    ? data.prereqs.filter((p) => !(authenticated && completedIds?.has(p.id)))
    : [];
  const prereqCheckPending = !!data && data.prereqs.length > 0 && !progressResolved;
  const contentLocked =
    !!data && data.prereqs.length > 0 && progressResolved && missingPrereqs.length > 0;

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.page}>
        {loading && <div className={styles.state}>Loading guide…</div>}
        {notFound && !loading && <div className={styles.state}>Guide not found.</div>}

        {data && !loading && (
          <>
            <header className={styles.header}>
              <Link href="/learn" className={styles.back}>
                <ArrowLeft size={16} weight="bold" /> Learn
              </Link>
              <h1 className={styles.title}>{data.guide.topicTitle}</h1>
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
              </div>

              <GuideMaterials materials={materials} />

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
            </header>

            <section className={styles.relSection}>
              <h2 className={styles.relHeading}>
                <TreeStructure size={16} weight="duotone" className={styles.relIcon} />
                Prerequisites
              </h2>
              <div className={styles.prereqRow}>
                {data.prereqs.length > 0 ? (
                  <div className={styles.chips}>
                    {data.prereqs.map((p) => (
                      <Link
                        key={p.id}
                        href={`/learn/guides/${p.slug}`}
                        className={styles.chip}
                        onMouseEnter={() => play('soft-hover')}
                        onClick={() => play('navigation')}
                      >
                        {p.topicTitle}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <p className={styles.prereqNone}>None. This topic stands on its own.</p>
                )}
                <CtaButton
                  variant="primary"
                  size="sm"
                  className={styles.walkthroughCta}
                  onMouseEnter={() => play('soft-hover')}
                  onClick={() => {
                    play('click');
                    setShowWalkthrough(true);
                  }}
                >
                  <GraduationCap size={14} weight="bold" />
                  Walkthrough
                </CtaButton>
              </div>
            </section>

            <BlueGuideCompanion guide={data.guide} prereqs={data.prereqs} />

            {prereqCheckPending ? (
              <div className={styles.state}>Checking your progress…</div>
            ) : contentLocked ? (
              <section
                className={styles.lockedPanel}
                aria-label="Locked until prerequisites are complete"
              >
                <div className={styles.lockedIconWrap}>
                  <LockKey size={22} weight="bold" />
                </div>
                <h2 className={styles.lockedTitle}>Complete the groundwork first</h2>
                <p className={styles.lockedText}>
                  {authenticated
                    ? 'This topic builds on the ideas below it. Finish its prerequisites and the full guide opens right here.'
                    : 'This topic builds on the ideas below it. Sign in and finish its prerequisites to open the full guide.'}
                </p>
                <div className={styles.chips}>
                  {missingPrereqs.map((p) => (
                    <Link
                      key={p.id}
                      href={`/learn/guides/${p.slug}`}
                      className={styles.chip}
                      onMouseEnter={() => play('soft-hover')}
                      onClick={() => play('navigation')}
                    >
                      {p.topicTitle}
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <>
                <div className={styles.divider} role="separator">
                  <span className={styles.dividerRule} />
                  <span className={styles.dividerBadge}>
                    <BookOpenText size={16} weight="duotone" />
                  </span>
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
              </>
            )}

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
                      href={`/learn/guides/${d.slug}`}
                      className={styles.chipNext}
                      onMouseEnter={() => play('soft-hover')}
                      onClick={() => play('navigation')}
                    >
                      {d.topicTitle} <ArrowRight size={10} weight="bold" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <VerificationLog guideId={data.guide.id} />

            <DisputeSection
              guideId={data.guide.id}
              footerAction={
                data.guide.status === 'published' ? (
                  <div className={styles.footerActions}>
                    {!contentLocked && !prereqCheckPending && (
                      <CtaButton
                        variant="primary"
                        size="lg"
                        block
                        disabled={isCompleted || completing}
                        onMouseEnter={() => !isCompleted && play('soft-hover')}
                        onClick={handleComplete}
                      >
                        {isCompleted ? (
                          <>
                            <CheckCircle size={18} weight="fill" />
                            Completed
                          </>
                        ) : (
                          <>
                            {completing ? 'Completing…' : 'Mark this guide complete'}
                            <span className={styles.rewardBadge}>
                              <Image
                                src="/icons/ui-diamond.svg"
                                alt=""
                                width={12}
                                height={12}
                              />
                              +{data.completeReward ?? 50}
                            </span>
                          </>
                        )}
                      </CtaButton>
                    )}
                    {completeError && (
                      <p className={styles.completeError}>{completeError}</p>
                    )}
                    <CtaButton
                      variant="secondary"
                      size="lg"
                      block
                      href={`/learn/guides/${data.guide.slug}/assemble`}
                      onMouseEnter={() => play('soft-hover')}
                      onClick={() => play('navigation')}
                    >
                      <PencilSimple size={18} weight="bold" />
                      Edit & Improve
                    </CtaButton>
                  </div>
                ) : undefined
              }
            />

            {showWalkthrough && (
              <WalkthroughOverlay
                slug={data.guide.slug}
                onClose={() => setShowWalkthrough(false)}
              />
            )}

            {showDiamondReward && (
              <DiamondReward
                amount={rewardDiamonds}
                onComplete={() => setShowDiamondReward(false)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
