import type { Metadata } from 'next';
import LandingPage from '@/components/landing/LandingPage';
import { LANDING_FAQ_ITEMS } from '@/components/landing/faqContent';

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
  const faqStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData).replace(/</g, '\\u003c'),
        }}
      />
      <LandingPage />
    </>
  );
}
