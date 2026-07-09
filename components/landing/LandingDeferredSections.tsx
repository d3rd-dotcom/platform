'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { LazySection } from './LazySection';
import { KeyFiguresSection } from './KeyFiguresSection';

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

/**
 * Below-the-fold sections. Each mounts as it nears the viewport (LazySection),
 * so hydration spreads across the scroll instead of firing all at once, and the
 * page is scrollable from first paint via the reserved placeholder heights.
 * The min-heights are estimates of each section's real height, kept close so the
 * content swap does not shift the scroll position.
 */
export function LandingDeferredSections() {
  // The donation popup is an overlay, not a scroll section, so it can't be
  // gated on scroll. Hold it until the browser is idle so it never competes
  // with the hero and first sections on initial load.
  const [popupReady, setPopupReady] = useState(false);

  useEffect(() => {
    const win = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    if (typeof win.requestIdleCallback === 'function') {
      const id = win.requestIdleCallback(() => setPopupReady(true), { timeout: 2500 });
      return () => win.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setPopupReady(true), 1800);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <>
      <LazySection minHeight="90vh"><FeaturesSection /></LazySection>
      <LazySection minHeight="90vh"><EcosystemSection /></LazySection>
      <LazySection minHeight="80vh"><FounderSection /></LazySection>
      <LazySection minHeight="80vh"><TestimonialSection /></LazySection>
      <LazySection minHeight="70vh"><KeyFiguresSection /></LazySection>
      <LazySection minHeight="90vh"><MagazineSection /></LazySection>
      <LazySection minHeight="90vh"><CohortSection /></LazySection>
      <LazySection minHeight="60vh"><PatternTextSection /></LazySection>
      <LazySection minHeight="80vh"><FAQSection /></LazySection>
      <LazySection minHeight="40vh"><LandingFooter /></LazySection>
      {popupReady && <DonationPopup />}
    </>
  );
}
