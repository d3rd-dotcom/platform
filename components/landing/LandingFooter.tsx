import styles from './LandingFooter.module.css';

export const LandingFooter = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <p className={styles.footerText}>
          © 2026 Mental Wealth Academy, Inc. · A Registered C Corp in Wyoming · EIN 94-2685973
        </p>
      </div>
    </footer>
  );
};
