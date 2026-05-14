'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import styles from './CohortSection.module.css';

const CubesCanvas = dynamic(() => import('./CohortCubes'), { ssr: false });

export const CohortSection = () => {
  return (
    <section id="cohort" className={styles.cohortSection}>
      <div className={styles.cubesBackground}>
        <CubesCanvas />
      </div>

      <div className={styles.cohortContainer}>
        <div className={styles.board}>

          <div className={styles.boardHeader}>
            <p className={styles.eyebrow}>
              <span className={styles.eyebrowAccent}>Cohort</span>
            </p>
          </div>

          <div className={styles.titlePanel}>
            <h2 className={styles.cohortTitle}>Next Gen of Decentralized Science</h2>
            <p className={styles.cohortSubtitle}>
              A living cohort of researchers, designers, and builders — running real experiments, earning on-chain rewards, and publishing results no institution owns.
            </p>
          </div>

          <div className={styles.cohortContentGrid}>
            {/* Left: Features */}
            <div className={styles.cohortFeatures}>

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/atom.svg" alt="Community Public Goods" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Decentralized Reward Ecosystem</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  Earn $Shards for every submission B.L.U.E. approves — paid directly to your wallet. No platform middleman, no delayed payouts, no permission required.
                </p>
              </div>

              <div className={styles.cohortDivider} />

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/refreshment.svg" alt="Accountability Partners" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Paid Research & Participation</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  Every quest you complete is compensated. Your time, attention, and behavioral data have real market value — and here, you're the one who gets paid for them.
                </p>
              </div>

              <div className={styles.cohortDivider} />

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/debate.svg" alt="Research-Grade Tools" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Institutional Data & Infrastructure</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  IRB-style protocols, verifiable on-chain credentials, and a behavioral dataset you co-own. The same infrastructure serious researchers use — without the gatekeeping.
                </p>
              </div>

            </div>

            {/* Right: Cohort photo collage */}
            <div className={styles.cohortDiamonds}>
              <div className={styles.cohortGrid}>
                <Image src="/images/cohort-1.png" alt="Students collaborating" width={200} height={200} className={styles.cohortImg} />
                <Image src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=400&fit=crop&crop=faces" alt="Campus study group" width={200} height={200} className={styles.cohortImg} />
                <Image src="/images/cohort-3.jpg" alt="Diverse cohort" width={200} height={200} className={styles.cohortImg} />
                <Image src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop&crop=faces" alt="Team working together" width={200} height={200} className={styles.cohortImg} />
                <Image src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=400&fit=crop&crop=faces" alt="Creative session" width={200} height={200} className={styles.cohortImg} />
                <Image src="https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=400&fit=crop&crop=faces" alt="Study session" width={200} height={200} className={styles.cohortImg} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
