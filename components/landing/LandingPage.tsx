import { LandingScene } from './LandingScene';
import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { LandingDeferredSections } from './LandingDeferredSections';
import { CohortSection } from './CohortSection';
import styles from './LandingPage.module.css';

// Server Component - Static content is server-rendered for fast LCP
const LandingPage = () => {
  return (
    <div className={styles.container}>
      {/* Header - Logo and CTAs */}
      <LandingHeader />

      {/* 3D Scene - Client component, loads after LCP */}
      <LandingScene />

      {/* Hero Section - Centered headline and CTA */}
      <HeroSection />

      {/* Swapped position: Cohort now appears where ecosystem section used to be */}
      <CohortSection />

      {/* Below-the-fold sections are deferred until after the hero is interactive. */}
      <LandingDeferredSections />
    </div>
  );
};

export default LandingPage;
