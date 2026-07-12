'use client';

import CtaButton from '../shared/CtaButton';
import styles from './CohortSection.module.css';

const CheckIcon = () => (
  <svg aria-hidden="true" viewBox="0 0 16 16" className={styles.checkIcon}>
    <path d="m3.25 8.25 3 3 6.5-6.5" />
  </svg>
);

const tiers = [
  {
    name: 'Foundation',
    price: '$20',
    cadence: '/ month',
    description: 'Build a steady practice with the Academy’s core learning path.',
    features: ['Full course library', 'Weekly quests and field notes', 'Community access'],
  },
  {
    name: 'Practice',
    price: '$50',
    cadence: '/ month',
    description: 'Make your study more active with deeper support and live work.',
    features: ['Everything in Foundation', 'Live study sessions', 'Research and project tools'],
    featured: true,
  },
  {
    name: 'Lifetime',
    price: '$888',
    cadence: 'one-time',
    description: 'Keep your place in the Academy through every course and cohort.',
    features: ['Everything in Practice', 'Lifetime course access', 'Priority cohort invitations'],
  },
];

export const CohortSection = () => {
  return (
    <section id="cohort" className={styles.cohortSection}>
      <div className={styles.cohortContainer}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>Choose your membership</p>
          <h2 className={styles.cohortTitle}>A place to keep doing the work.</h2>
          <p className={styles.cohortSubtitle}>
            Start with the essentials, deepen your practice, or join for the long arc. Every tier gives you a clear way into the Academy.
          </p>
        </div>

        <div className={styles.tierGrid}>
          {tiers.map((tier) => (
            <article key={tier.name} className={`${styles.tierCard} ${tier.featured ? styles.featuredTier : ''}`}>
              {tier.featured && <span className={styles.tierBadge}>Most chosen</span>}
              <div className={styles.tierTopline}>
                <p className={styles.tierName}>{tier.name}</p>
                <span className={styles.tierIndex}>0{tiers.indexOf(tier) + 1}</span>
              </div>
              <div className={styles.priceRow}>
                <span className={styles.tierPrice}>{tier.price}</span>
                <span className={styles.tierCadence}>{tier.cadence}</span>
              </div>
              <p className={styles.tierDescription}>{tier.description}</p>
              <div className={styles.tierRule} />
              <ul className={styles.tierFeatures}>
                {tier.features.map((feature) => (
                  <li key={feature} className={styles.tierFeature}>
                    <span className={styles.check}><CheckIcon /></span>
                    {feature}
                  </li>
                ))}
              </ul>
              <CtaButton variant={tier.featured ? 'primary' : 'secondary'} size="md" block className={styles.tierCta}>
                Choose {tier.name}
              </CtaButton>
            </article>
          ))}
        </div>
        <p className={styles.membershipNote}>Membership supports the Academy’s courses, community, and ongoing research.</p>
      </div>
    </section>
  );
};
