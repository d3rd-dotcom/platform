'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import GuideStudio from '@/components/course-studio/GuideStudio';

export default function NewGuidePage() {
  const router = useRouter();
  const { getAccessToken } = usePrivy();

  const authHeaders = useCallback(async (): Promise<HeadersInit> => {
    const token = await getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, [getAccessToken]);

  return (
    <GuideStudio
      authHeaders={authHeaders}
      onExit={() => router.push('/home')}
      onCreated={(slug) => {
        // Move to the stable edit URL once the draft exists (keeps refreshes sane).
        router.replace(`/course-studio/guide/${slug}`);
      }}
    />
  );
}
