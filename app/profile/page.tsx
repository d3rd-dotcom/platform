'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import SideNavigation from '@/components/side-navigation/SideNavigation';
import CyberpunkDataViz from '@/components/cyberpunk-data-viz/CyberpunkDataViz';
import ProfileDashboard from '@/components/courses/ProfileDashboard';
import type { PanelCourse } from '@/components/courses/ProfileDashboard';
import VerifierBadges from '@/components/guides/VerifierBadges';
import VerifierCredentials from '@/components/guides/VerifierCredentials';
import VerifierPanelQueue from '@/components/guides/VerifierPanelQueue';
import styles from './page.module.css';

export default function ProfilePage() {
  const { ready, getAccessToken } = usePrivy();
  const [courses, setCourses] = useState<PanelCourse[]>([]);

  useEffect(() => {
    if (!ready) return;

    const loadCourses = async () => {
      try {
        const token = await getAccessToken();
        const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

        const [publicRes, academyRes] = await Promise.all([
          fetch('/api/vip/courses/public', { cache: 'no-store', headers }),
          fetch('/api/course-content'),
        ]);

        const list: PanelCourse[] = [];

        if (publicRes.ok) {
          const data = await publicRes.json();
          const all = data.courses ?? [];
          const shadow = all.find((c: any) => c.slug === 'creative-healing');
          if (shadow) list.push({ title: 'Shadow Work', href: '/shadow-work', progressPct: shadow.viewerProgressPct ?? 0 });
          for (const c of all.filter((x: any) => x.slug !== 'creative-healing')) {
            list.push({ title: c.title, href: `/course/${c.slug}`, progressPct: c.viewerProgressPct ?? 0 });
          }
        }

        if (academyRes.ok) {
          const data = await academyRes.json();
          for (const c of (data.courses ?? [])) {
            list.push({ title: c.title, href: `/course/${c.slug}`, progressPct: 0 });
          }
        }

        setCourses(list);
      } catch { /* ignore */ }
    };

    loadCourses();
  }, [ready, getAccessToken]);

  return (
    <div className={styles.pageLayout}>
      <div className={styles.bgViz}><CyberpunkDataViz /></div>
      <SideNavigation />
      <main className={styles.page}>
        <section className={styles.shell}>
          <ProfileDashboard courses={courses} />
        </section>
        <section className={styles.shell}>
          <VerifierBadges />
          <VerifierCredentials />
        </section>
        <section className={styles.shell}>
          <VerifierPanelQueue />
        </section>
      </main>
    </div>
  );
}
