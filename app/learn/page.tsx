import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import LearnLoading from './loading';

const LearnContent = dynamic(() => import('@/app/home/page'), {
  ssr: false,
  loading: () => <LearnLoading />,
});

export default function LearnPage() {
  return (
    <Suspense fallback={<LearnLoading />}>
      <LearnContent />
    </Suspense>
  );
}
