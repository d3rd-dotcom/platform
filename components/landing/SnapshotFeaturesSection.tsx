import Link from 'next/link';
import styles from './SnapshotFeaturesSection.module.css';

const features = [
  {
    title: 'New Experiments Every Week',
    body:
      'Twelve weeks of quests, readings, and field studies. Real start, real end — applied behavioral research with collaborators who publish.',
  },
  {
    title: 'Participatory Research',
    body:
      'Blue reads every submission and pays out the reward. Your reflections become training data. Her judgments evolve as you do.',
  },
  {
    title: 'Universal Diamond System',
    body:
      'On-chain diamonds earned in one case-study app, spendable across all of them. Diamonds live in your wallet - not on our servers.',
  },
];

export const SnapshotFeaturesSection: React.FC = () => {
  return (
    <section className={styles.section} aria-labelledby="snapshot-features-eyebrow">
      <div className={styles.container}>
        <header className={styles.header}>
          <p id="snapshot-features-eyebrow" className={styles.eyebrow}>
            <span className={styles.eyebrowAccent}>Features</span>
          </p>
        </header>

        <div className={styles.grid}>
          {features.map((feature) => (
            <article key={feature.title} className={styles.cell}>
              <h3 className={styles.cellTitle}>{feature.title}</h3>
              <p className={styles.cellBody}>{feature.body}</p>
            </article>
          ))}
        </div>

        <div className={styles.footer}>
          <Link href="/home" className={styles.moreLink}>
            More Details
            <svg
              className={styles.chevron}
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default SnapshotFeaturesSection;
