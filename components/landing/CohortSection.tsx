'use client';

import Image from 'next/image';
import dynamic from 'next/dynamic';
import { DiscordLogo } from '@phosphor-icons/react';
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

          <div className={styles.titlePanel}>
            <div className={styles.titlePanelText}>
              <h2 className={styles.cohortTitle}>The Next-Gen Of Cyberculture</h2>
              <p className={styles.cohortSubtitle}>
                An intellectual refreshment. Over 4–12 weeks, you will unlock rewards, access industry experts, run real experiments, and contribute to the future of scientific growth.
              </p>
            </div>
            <a
              href="https://discord.gg/ZTRVCYwncs"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.discordPill}
            >
              <DiscordLogo size={24} weight="fill" aria-hidden="true" />
              <span>Join the Discord</span>
            </a>
          </div>

          <div className={styles.cohortContentGrid}>
            {/* Left: Features */}
            <div className={styles.cohortFeatures}>

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/refreshment.svg" alt="" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Participatory Research</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  Run real experiments as part of the cohort — every quest you complete adds to the research and pays you for your time.
                </p>
              </div>

              <div className={styles.cohortDivider} />

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/atom.svg" alt="" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>DeFi Ecosystem</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  Earn rewards for every approved submission, paid straight to your wallet.
                </p>
              </div>

              <div className={styles.cohortDivider} />

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={`${styles.cohortFeatureIcon} ${styles.cohortFeatureIconLight}`}>
                    <Image src="/icons/survey.svg" alt="" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Shared Infrastructure</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  IRB-style protocols, onchain credentials, and a behavioral dataset you co-own.
                </p>
              </div>

            </div>

            {/* Right: Cohort photo collage */}
            <div className={styles.cohortDiamonds}>
              <div className={styles.cohortGrid}>
                <div className={styles.cohortImgCell}>
                  <Image src="/images/cohort-1.png" alt="Students collaborating" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=400&h=400&fit=crop&crop=faces" alt="Campus study group" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="/images/cohort-3.jpg" alt="Diverse cohort" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=400&h=400&fit=crop&crop=faces" alt="Team working together" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=400&h=400&fit=crop&crop=faces" alt="Creative session" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
                <div className={styles.cohortImgCell}>
                  <Image src="https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=400&h=400&fit=crop&crop=faces" alt="Study session" fill sizes="(min-width: 1024px) 25vw, 100vw" className={styles.cohortImg} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
