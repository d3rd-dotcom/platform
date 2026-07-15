import styles from './SideNavSkeleton.module.css';

const navRows = Array.from({ length: 6 }, (_, index) => index);

/**
 * Static placeholder for the left SideNavigation, used inside route
 * loading.tsx files. The real SideNavigation is a heavy client component
 * (wallet hooks, portals, dynamic chunks) that remounts in its default
 * expanded width during route transitions, so it visually jumps against
 * the page skeleton. This traces the same footprint instead: it reads the
 * live --sidebar-width variable, so it stays 72px when the user has the
 * rail collapsed and 265px when expanded, and hides at the same 900px
 * breakpoint where the real nav swaps to the mobile bottom bar.
 */
export default function SideNavSkeleton() {
  return (
    <div className={styles.sideNav} aria-hidden="true">
      <span className={`${styles.skeleton} ${styles.sectionLabel}`} />
      <div className={styles.navList}>
        {navRows.map((index) => (
          <div className={styles.navRow} key={index}>
            <span className={`${styles.skeleton} ${styles.navIcon}`} />
            <span
              className={`${styles.skeleton} ${styles.navLabel}`}
              style={{ width: `${[72, 58, 84, 64, 76, 52][index]}%` }}
            />
          </div>
        ))}
      </div>
      <div className={styles.footer}>
        <span className={`${styles.skeleton} ${styles.footerAvatar}`} />
        <span className={`${styles.skeleton} ${styles.footerLabel}`} />
      </div>
    </div>
  );
}
