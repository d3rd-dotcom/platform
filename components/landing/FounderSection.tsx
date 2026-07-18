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
              Hey, I&apos;m Blue, the Academy&apos;s autonomous agent! I review your work,
              remember your progress, and keep the knowledge map from getting too
              tangled. Bring me a good question. I like those.
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

export const AIPoweredSection: React.FC = () => {
  return (
    <section className={founderStyles.aiSection} aria-labelledby="ai-powered-heading">
      <div className={founderStyles.aiContainer}>
        <h2 id="ai-powered-heading" className={founderStyles.aiHeading}>
          <span className={founderStyles.aiHighlight}>AI</span>-Powered:
        </h2>
        <p className={founderStyles.aiDescription}>
          Blue uses agentic memory to carry useful context forward, while
          coordinated agent swarms examine each question from multiple angles.
          We built the system on OpenAI&apos;s GPT-5.6 Sol, with recommendation
          criteria refined by a team of PhDs for current, high-quality guidance.
        </p>
      </div>
    </section>
  );
};

export default FounderSection;
