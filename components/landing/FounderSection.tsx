import Image from 'next/image';
import { ArrowRight } from '@phosphor-icons/react';
import ThinkingOrbBadge from './ThinkingOrbBadge';
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
        <div className={founderStyles.aiHeadingBlock}>
          <h2 id="ai-powered-heading" className={founderStyles.aiHeading}>
            <span className={founderStyles.aiHighlight}>AI</span>-Powered:
          </h2>
          <ThinkingOrbBadge label="Building your optimal curricula" block />
        </div>
        <p className={founderStyles.aiDescription}>
          Blue uses long-term memory and context to help build expert-level courses.
          Fine-tuned by months of work, input from PhD students. Blue&apos;s coordinated
          agentic swarm examines each topic from multiple angles. Operating with
          OpenAI&apos;s GPT-5.6 Sol, Blue agent is a catalyst refining quality education,
          giving educators the tools they really need to pass the baton forward.
        </p>
      </div>
    </section>
  );
};

export default FounderSection;
