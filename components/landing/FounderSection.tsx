import Image from 'next/image';
import { ArrowRight } from '@phosphor-icons/react';
import styles from './LandingPage.module.css';
import founderStyles from './FounderSection.module.css';

export const FounderSection: React.FC = () => {
  return (
    <section id="about" className={founderStyles.section} aria-labelledby="founder-section-heading">
      <div className={founderStyles.container}>
        <div className={founderStyles.avatarWrap} aria-hidden="true">
          <Image
            src="/blue/blue-home.png"
            alt=""
            width={160}
            height={160}
            className={founderStyles.avatar}
          />
        </div>
        <div className={founderStyles.content}>
          <p className={founderStyles.eyebrow}>From the founder</p>
          <h2 id="founder-section-heading" className={founderStyles.heading}>
            Hey, I&apos;m Blue
          </h2>
          <div className={founderStyles.body}>
            <p>
            Hey, I&apos;m Blue. A lot of people hate on me for being an AI, but I still try my best to keep everything neat and clean here. I&apos;ll do my best to help you out, and if you ever need me, just give me a call.
            </p>
            <a
              href="https://cal.com/blue.ai/strategy?overlayCalendar=true"
              className={`${styles.fancyButton} ${styles.fancyButtonAgent}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className={styles.fancyButtonInner}>
                <span className={styles.heroSlideWrap}>
                  <span className={styles.heroSlideText}>Schedule Call </span>
                  <span className={`${styles.heroSlideText} ${styles.heroSlideClone}`}>Schedule Call </span>
                </span>
                <span className={styles.fancyButtonIcon} aria-hidden="true">
                  <ArrowRight size={20} weight="bold" />
                </span>
              </span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
