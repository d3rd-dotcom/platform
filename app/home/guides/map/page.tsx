'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePrivy } from '@privy-io/react-auth';
import { ArrowLeft, CircleNotch, Plus } from '@phosphor-icons/react';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import GuideSkillTree from '@/components/guides/GuideSkillTree';
import type { KnowledgeMap } from '@/lib/guides-db';
import styles from './page.module.css';

export default function KnowledgeMapPage() {
  const { ready, getAccessToken } = usePrivy();
  const [map, setMap] = useState<KnowledgeMap | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken().catch(() => null);
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/guides/map', { cache: 'no-store', headers });
      if (!res.ok) {
        setError('Could not load the knowledge map.');
        return;
      }
      const data = await res.json();
      setMap((data.map as KnowledgeMap) ?? null);
      setError(null);
    } catch {
      setError('Could not load the knowledge map.');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (!ready) return;
    load();
  }, [ready, load]);

  const completed = useMemo(
    () => new Set((map?.nodes ?? []).filter((n) => n.completed).map((n) => n.id)),
    [map],
  );

  const nodeCount = map?.nodes.length ?? 0;
  const completedCount = completed.size;
  const depthCount = map?.levels ?? 0;
  const readyCount = useMemo(
    () =>
      (map?.nodes ?? []).filter(
        (node) =>
          !completed.has(node.id) &&
          node.prereqIds.every((prereqId) => completed.has(prereqId)),
      ).length,
    [completed, map],
  );

  return (
    <div className={styles.layout}>
      <SideNavigation />
      <main className={styles.page}>
        <Link href="/home" className={styles.back}>
          <ArrowLeft size={16} weight="bold" /> Back to courses
        </Link>

        <header className={styles.header}>
          <span className={styles.eyebrow}>Knowledge base</span>
          <h1 className={styles.title}>Knowledge map</h1>
          <p className={styles.lede}>
            Every published guide, connected by what it builds on. Start at the base and climb —
            each guide you clear lights the path to the next.
          </p>
        </header>

        {!loading && !error && nodeCount > 0 && (
          <div className={styles.stats}>
            <span className={styles.stat}>
              <span className={styles.statNum}>{nodeCount}</span>
              <span className={styles.statLabel}>{nodeCount === 1 ? 'guide' : 'guides'}</span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statNum}>{depthCount}</span>
              <span className={styles.statLabel}>
                {depthCount === 1 ? 'depth' : 'depths'}
              </span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statNum}>{completedCount}</span>
              <span className={styles.statLabel}>cleared</span>
            </span>
            <span className={styles.statDivider} />
            <span className={styles.stat}>
              <span className={styles.statNum}>{readyCount}</span>
              <span className={styles.statLabel}>ready now</span>
            </span>
          </div>
        )}

        <section className={styles.panel}>
          {loading ? (
            <div className={styles.state}>
              <CircleNotch size={18} /> Loading the map…
            </div>
          ) : error ? (
            <div className={styles.state}>{error}</div>
          ) : nodeCount === 0 ? (
            <div className={styles.empty}>
              <h2 className={styles.emptyTitle}>The map is just getting started</h2>
              <p className={styles.emptyHint}>
                No guides are published yet. Write the first one and it becomes the root everything
                else grows from.
              </p>
              <Link href="/course-studio/guide/new" className={styles.contributeBtn}>
                <Plus size={14} weight="bold" /> Write a guide
              </Link>
            </div>
          ) : (
            <GuideSkillTree
              nodes={map!.nodes}
              levels={map!.levels}
              completed={completed}
              clusterBySubject
            />
          )}
        </section>

        {!loading && !error && nodeCount > 0 && (
          <div className={styles.contribute}>
            <div className={styles.contributeCopy}>
              <span className={styles.contributeTitle}>Missing a topic?</span>
              <span className={styles.contributeHint}>
                The map grows as guides get published. Add yours in the studio.
              </span>
            </div>
            <Link href="/course-studio/guide/new" className={styles.contributeBtn}>
              <Plus size={14} weight="bold" /> Write a guide
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
