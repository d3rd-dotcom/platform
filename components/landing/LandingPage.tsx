import { LandingHeader } from './LandingHeader';
import { HeroSection } from './HeroSection';
import { LandingDeferredSections } from './LandingDeferredSections';
import { LandingSoundEffects } from './LandingSoundEffects';
import styles from './LandingPage.module.css';

// Server Component - Static content is server-rendered for fast LCP
const LandingPage = () => {
  return (
    <div className={styles.container} data-landing-page>
      <LandingSoundEffects />
      {/* Header - Logo and CTAs */}
      <LandingHeader />

      {/* Hero Section - Centered headline and CTA (canvas inside) */}
      <HeroSection />

      {/* Below-the-fold sections are deferred until after the hero is interactive. */}
      <LandingDeferredSections />
    </div>
  );
};

export default LandingPage;
