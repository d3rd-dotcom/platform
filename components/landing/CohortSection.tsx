'use client';

import Image from 'next/image';
import CtaButton from '../shared/CtaButton';
import styles from './CohortSection.module.css';

const tiers = [
  {
    name: 'Explorer',
    price: '$0/mo',
    description: 'Start free with courses, community access, and monthly calls.',
    features: [
      'Community access',
      'Public research library',
      'Monthly community calls',
    ],
  },
  {
    name: 'Researcher',
    price: '$3/mo',
    description: 'Join live studies, earn credits for approved work, and help shape proposals.',
    features: [
      'Everything in Explorer',
      'Participate in live research',
      'Earn credits for contributions',
    ],
  },
  {
    name: 'Architect',
    price: '$20/mo',
    description: 'Help govern the protocols and behavioral dataset behind the academy.',
    features: [
      'Everything in Researcher',
      'Governance and voting rights',
      'Early access to all research',
    ],
  },
];

export const CohortSection = () => {
  return (
    <section id="cohort" className={styles.cohortSection}>

      <div className={styles.cohortContainer}>
        <div className={styles.board}>

          <div className={styles.titlePanel}>
            <div className={styles.titlePanelText}>
              <h2 className={styles.cohortTitle}>Cohort memberships</h2>
              <p className={styles.cohortSubtitle}>
                Choose how you want to participate. Start free, join live research, or help govern the infrastructure behind quests, credits, and community-funded studies.
              </p>
            </div>
          </div>

          <div className={styles.cohortContentGrid}>
            {/* Left: Cohort photo collage */}
            <div className={styles.cohortDiamonds}>
              <div className={styles.cohortGrid}>
                <div className={styles.cohortImgCell}>
                  <Image src="/images/cohort-1.png" alt="Students collaborating" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=600&fit=crop&crop=faces" alt="Campus study group" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="/images/cohort-3.jpg" alt="Diverse cohort" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=600&fit=crop&crop=faces" alt="Team working together" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=600&fit=crop&crop=faces" alt="Creative session" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=600&fit=crop&crop=faces" alt="Study session" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
              </div>
            </div>

            {/* Right: Membership tiers */}
            <div className={styles.tiers}>
              {tiers.map((tier) => (
                <div key={tier.name} className={styles.tierCard}>
                  <div className={styles.tierHeader}>
                    <h3 className={styles.tierName}>{tier.name}</h3>
                    <span className={styles.tierPrice}>{tier.price}</span>
                  </div>
                  <p className={styles.tierDescription}>{tier.description}</p>
                  <ul className={styles.tierFeatureList}>
                    {tier.features.map((f) => (
                      <li key={f} className={styles.tierFeatureItem}>{f}</li>
                    ))}
                  </ul>
                  <CtaButton
                    variant={tier.name === 'Explorer' ? 'secondary' : 'primary'}
                    size="sm"
                    className={styles.tierCta}
                  >
                    {tier.name === 'Explorer' ? 'Get started' : `Join ${tier.name}`}
                  </CtaButton>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
