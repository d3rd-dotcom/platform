'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { KeyFiguresSection } from './KeyFiguresSection';
import { ScrollExperience } from './scroll/ScrollExperience';
import { BrollBand } from './scroll/BrollBand';
const CohortSection = dynamic(() =>
  import('./CohortSection').then((mod) => mod.CohortSection),
  { ssr: false }
);
const EcosystemSection = dynamic(() =>
  import('./EcosystemSection').then((mod) => mod.EcosystemSection),
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
const MagazineSection = dynamic(() =>
  import('./MagazineSection').then((mod) => mod.MagazineSection),
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
      <ScrollExperience />

      {/* Act I — the promise: simulate your world. */}
      <div data-act="simulate">
        <BrollBand
          src="/landing/broll/broll-simulate.mp4"
          tone="indigo"
          eyebrow="Act I"
          title="A world you can simulate"
        />
        <div data-reveal>
          <FeaturesSection />
        </div>
      </div>

      {/* Act II — the world: a living ecosystem. */}
      <div data-act="ecosystem">
        <BrollBand
          src="/landing/broll/broll-ecosystem.mp4"
          tone="teal"
          eyebrow="Act II"
          title="A place, not a product"
        />
        <div data-reveal>
          <EcosystemSection />
        </div>
      </div>

      {/* Act III — the people: human proof, at reading pace. */}
      <div data-act="belonging">
        <BrollBand
          src="/landing/broll/broll-belonging.mp4"
          tone="amber"
          eyebrow="Act III"
          title="Built by and for people like you"
        />
        <div data-reveal>
          <FounderSection />
        </div>
        <div data-reveal>
          <TestimonialSection />
        </div>
        <div data-reveal>
          <KeyFiguresSection />
        </div>
        <div data-reveal>
          <MagazineSection />
        </div>
      </div>

      {/* Act IV — the invitation: ascend. The page's only pin. */}
      <div data-act="ascend">
        <BrollBand
          src="/landing/broll/broll-ascend.mp4"
          tone="dawn"
          eyebrow="Act IV"
          title="Enter the academy"
          pin
        />
        <div data-reveal>
          <CohortSection />
        </div>
        <div data-reveal>
          <PatternTextSection />
        </div>
        <div data-reveal>
          <FAQSection />
        </div>
      </div>

      <LandingFooter />
      <DonationPopup />
    </>
  );
}
