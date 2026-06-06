'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const CompanyLogos = dynamic(() => import('./CompanyLogos'), { ssr: false });
const CohortSection = dynamic(() =>
  import('./CohortSection').then((mod) => mod.CohortSection),
  { ssr: false }
);
const EcosystemSection = dynamic(() =>
  import('./HeroSection').then((mod) => mod.EcosystemSection),
  { ssr: false }
);
const FounderSection = dynamic(() =>
  import('./FounderSection').then((mod) => mod.FounderSection),
  { ssr: false }
);
const TestimonialSection = dynamic(() =>
  import('./TestimonialSection').then((mod) => mod.TestimonialSection),
  { ssr: false }
);
const FeaturesSection = dynamic(() =>
  import('./FeaturesSection').then((mod) => mod.FeaturesSection),
  { ssr: false }
);
const PatternTextSection = dynamic(() =>
  import('./PatternTextSection').then((mod) => mod.PatternTextSection),
  { ssr: false }
);
const FAQSection = dynamic(() =>
  import('./FAQSection').then((mod) => mod.FAQSection),
  { ssr: false }
);
const LandingFooter = dynamic(() =>
  import('./LandingFooter').then((mod) => mod.LandingFooter),
  { ssr: false }
);
const DonationPopup = dynamic(() =>
  import('./DonationPopup').then((mod) => mod.DonationPopup),
  { ssr: false }
);

export function LandingDeferredSections() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setMounted(true), { timeout: 1200 });
      return () => window.cancelIdleCallback(id);
    }

    const id = setTimeout(() => setMounted(true), 700);
    return () => clearTimeout(id);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <EcosystemSection />
      <FeaturesSection />
      <FounderSection />
      <TestimonialSection />
      <CohortSection />
      <CompanyLogos />
      <PatternTextSection />
      <FAQSection />
      <LandingFooter />
      <DonationPopup />
    </>
  );
}
