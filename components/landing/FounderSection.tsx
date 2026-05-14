import Image from 'next/image';
import styles from './FounderSection.module.css';

export const FounderSection: React.FC = () => {
  return (
    <section id="about" className={styles.section} aria-labelledby="founder-section-heading">
      <div className={styles.container}>
        <div className={styles.avatarWrap} aria-hidden="true">
          <Image
            src="/images/James.jpg"
            alt=""
            width={160}
            height={160}
            className={styles.avatar}
          />
        </div>
        <div className={styles.content}>
          <p className={styles.eyebrow}>From the founder</p>
          <h2 id="founder-section-heading" className={styles.heading}>
            Hey, I&apos;m James
          </h2>
          <div className={styles.body}>
            <p>
              Academia is enclosed. Debt without funding, knowledge gatekept, no exit. I&apos;m an artist — I build the systems the institutions can&apos;t.
            </p>
            <p>
              Mental Wealth Academy is my attempt to fix this. Accountability, edutainment, and a community of focused creatives and intellectuals.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FounderSection;
