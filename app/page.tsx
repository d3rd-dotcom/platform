import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';

const description =
  'Mental Wealth Academy is a community education platform for collaborative learning, structured reflection, and contribution-based study across mental wellness, financial literacy, and related subjects.';

export const metadata: Metadata = {
  title: 'Mental Wealth Academy | Community Education and Cohort Learning',
  description,
  alternates: {
    canonical: 'https://mentalwealthacademy.world/',
  },
  openGraph: {
    title: 'Mental Wealth Academy | Community Education and Cohort Learning',
    description,
    type: 'website',
    url: 'https://mentalwealthacademy.world/',
    images: [
      {
        url: 'https://mentalwealthacademy.world/images/landing-starfield.jpg',
        alt: 'Mental Wealth Academy',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mental Wealth Academy | Community Education and Cohort Learning',
    description,
    images: ['https://mentalwealthacademy.world/images/landing-starfield.jpg'],
  },
};

export default function Page() {
  return <LandingPage />;
}
