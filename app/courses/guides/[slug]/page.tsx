'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, GraduationCap, TreeStructure, RocketLaunch } from '@phosphor-icons/react';
import { usePrivy } from '@privy-io/react-auth';
import { useSound } from '@/hooks/useSound';
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
import styles from './page.module.css';

type PageProps = { params: { slug: string } };

interface GuidePayload {
  guide: GuideRecord;
  methods: GuideMethodRecord[];
  prereqs: GuideLink[];
  dependents: GuideLink[];
  level?: number;
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
        <Link href="/courses" className={styles.back}>
          <ArrowLeft size={16} weight="bold" /> Knowledge Base
        </Link>

        {loading && <div className={styles.state}>Loading guide…</div>}
        {notFound && !loading && <div className={styles.state}>Guide not found.</div>}

        {data && !loading && (
          <>
            <header className={styles.header}>
              <div className={styles.subjects}>
                {data.guide.subjects.map((s) => (
                  <span key={s} className={styles.subjectTag}>{s}</span>
                ))}
                {typeof data.level === 'number' && (
                  <span className={styles.levelChip}>Level {data.level}</span>
                )}
              </div>
              <h1 className={styles.title}>{data.guide.topicTitle}</h1>
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
                      href={`/courses/guides/${p.slug}`}
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

            <button
              type="button"
              className={styles.walkthroughBtn}
              onMouseEnter={() => play('soft-hover')}
              onClick={() => {
                play('click');
                setShowWalkthrough((v) => !v);
              }}
            >
              <GraduationCap size={18} weight="bold" />
              {showWalkthrough ? 'Hide walkthrough' : 'Start walkthrough'}
            </button>

            {showWalkthrough && (
              <section className={styles.walkthroughPanel}>
                <GuideWalkthrough slug={data.guide.slug} />
              </section>
            )}

            <article className={styles.content}>
              <GuideBody body={data.guide.body} />
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
                      href={`/courses/guides/${d.slug}`}
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
          </>
        )}
      </main>
    </div>
  );
}
