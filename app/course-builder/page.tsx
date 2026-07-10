'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import CourseStudioModal from '@/components/course-studio/CourseStudioModal';

function CourseBuilderInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { getAccessToken } = usePrivy();
  const [editId, setEditId] = useState<string | null>(null);
  const [initialCourse, setInitialCourse] = useState<{
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
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const edit = searchParams.get('edit');
    const gen = searchParams.get('gen');

    if (edit) {
      setEditId(edit);
    }

    if (gen) {
      try {
        const stored = sessionStorage.getItem('course-builder-gen');
        if (stored) {
          setInitialCourse(JSON.parse(stored));
          sessionStorage.removeItem('course-builder-gen');
        }
      } catch {}
    }

    setReady(true);
  }, [searchParams]);

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100dvh', gap: 20, background: 'var(--color-surface-base)' }}>
        <div style={{ width: 36, height: 36, border: '3px solid var(--color-border-subtle)', borderTopColor: 'var(--color-primary)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}>Opening course builder...</span>
      </div>
    );
  }

  return (
    <CourseStudioModal
      authHeaders={authHeaders}
      onClose={() => router.push('/home')}
      onCourseCreated={() => router.push('/home')}
      existingCourseId={editId ?? undefined}
      initialCourse={initialCourse ?? undefined}
    />
  );
}

export default function CourseBuilderPage() {
  return (
    <Suspense fallback={null}>
      <CourseBuilderInner />
    </Suspense>
  );
}
