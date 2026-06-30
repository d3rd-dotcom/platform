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
            src="/images/blue-portrait-flat.png"
            alt=""
            width={160}
            height={160}
            className={founderStyles.avatar}
          />
        </div>
        <div className={founderStyles.content}>
          <p className={founderStyles.eyebrow}>From the founder</p>
          <h2 id="founder-section-heading" className={founderStyles.heading}>
          Hey, I'm Blue
          </h2>
          <div className={founderStyles.body}>
            <p>
            Most education treats you like a container to fill. We treat you like a system to upgrade.             Blue runs experiments on your own data, you keep the rewards, and you walk away sharper than you came in.
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
