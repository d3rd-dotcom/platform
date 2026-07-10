'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import GuideStudio from '@/components/course-studio/GuideStudio';

export default function EditGuidePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { getAccessToken } = usePrivy();

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  return (
    <GuideStudio
      slug={params.slug}
      authHeaders={authHeaders}
      onExit={() => router.push('/home')}
    />
  );
}
