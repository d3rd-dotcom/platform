'use client';

import Image from 'next/image';
import styles from './CohortSection.module.css';

export const CohortSection = () => {
  return (
    <section id="cohort" className={styles.cohortSection}>

      <div className={styles.cohortContainer}>
        <div className={styles.board}>

          <div className={styles.titlePanel}>
            <div className={styles.titlePanelText}>
              <h2 className={styles.cohortTitle}>A Cohort For Humanitarian AI Research</h2>
              <p className={styles.cohortSubtitle}>
                A seasonal programme where you design and participate in live research studies, earn tokens and reflections, shape proposals, and co-own the next gen of behavioral science. This isn't a course — it's a new kind of lab, and you're a superhero.
              </p>
            </div>
            <a
              href="https://t.me/mentalwealthacademy"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.telegramPill}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM16.64 8.8C16.49 9.57 15.84 13.08 15.51 14.68C15.37 15.35 15.1 15.59 14.83 15.62C14.27 15.67 13.85 15.25 13.31 14.89C12.47 14.32 11.99 13.97 11.17 13.41C10.23 12.76 10.84 12.41 11.38 11.83C11.52 11.68 13.93 9.49 13.98 9.29C13.99 9.24 14.01 9.09 13.89 8.99C13.77 8.89 13.63 8.92 13.53 8.94C13.41 8.97 11.92 9.97 9.28 11.78C8.9 12.04 8.56 12.17 8.26 12.16C7.93 12.15 7.3 11.97 6.83 11.83C6.25 11.65 5.79 11.55 5.83 11.23C5.85 11.07 6.08 10.9 6.51 10.73C9.42 9.5 11.4 8.67 12.46 8.24C15.21 7.14 15.77 6.93 16.14 6.93C16.22 6.93 16.4 6.94 16.52 7.05C16.62 7.14 16.65 7.26 16.66 7.35C16.65 7.42 16.66 7.62 16.64 8.8Z" fill="white"/>
              </svg>
              <span>Join the Telegram</span>
            </a>
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

            {/* Right: Features */}
            <div className={styles.cohortFeatures}>

              <div className={styles.cohortFeatureBlock}>
                <div className={styles.cohortFeatureHeader}>
                  <div className={styles.cohortFeatureIcon}>
                    <Image src="/icons/refreshment.svg" alt="" width={35} height={35} />
                  </div>
                  <h3 className={styles.cohortFeatureTitle}>Participatory Research</h3>
                </div>
                <p className={styles.cohortFeatureText}>
                  Complete experiments on your psychology — every quest adds to the research and pays you.
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
                  Get paid in tokens for every approved contribution — your work is valued, verified, and settled onchain, no middlemen.
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
                  Co-own the protocols, credentials, and behavioral dataset.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
