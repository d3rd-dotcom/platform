import Image from 'next/image';
import styles from './FounderSection.module.css';

export const FounderSection: React.FC = () => {
  return (
    <section id="about" className={styles.section} aria-labelledby="founder-section-heading">
      <div className={styles.container}>
        <div className={styles.avatarWrap} aria-hidden="true">
          <Image
            src="/founder-james.png"
            alt=""
            width={160}
            height={160}
            className={styles.avatar}
          />
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>From the founder</p>
          <h2 id="founder-section-heading" className={styles.heading}>
            Hey, I&apos;m James 🇺🇸
          </h2>
          <div className={styles.body}>
            <p>
              American education has a proximity problem. Where poorer communities are unable to access the same tools or utilize the power of Blockchain, AI, and other tools.
            </p>
            <p>
              Decentralization allows us to change that, so previously underserved communities can connect and access the same tools and research opportunities as any other American.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
