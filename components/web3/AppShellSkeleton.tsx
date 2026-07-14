import styles from './AppShellSkeleton.module.css';

const railIcons = Array.from({ length: 4 }, (_, index) => index);
const indicators = Array.from({ length: 3 }, (_, index) => index);
const tabs = Array.from({ length: 3 }, (_, index) => index);
const folderCards = Array.from({ length: 4 }, (_, index) => index);
const courseCards = Array.from({ length: 3 }, (_, index) => index);

/**
 * Lightweight, dependency-free placeholder shown while the wallet provider
 * (Privy + wagmi) chunk loads. It renders OUTSIDE the Web3 context, so it must
 * not use any wallet hooks. Its job is to give the authenticated routes an
 * immediate, on-brand first paint instead of a blank screen while the heavy
 * wallet SDK downloads — a large FCP/LCP win on every gated route.
 *
 * Traces the full real app shell — rail, topbar (menu, logo, search,
 * nav pills, right-side actions), and the /home dashboard (profile,
 * indicators, daily notes, folder tabs + row, course grid) — instead of a
 * couple of generic shapes. Reveals left to right, top to bottom, so it
 * reads as the same loading language as app/home/loading.tsx, which takes
 * over right after.
 */
export function AppShellSkeleton() {
  return (
    <div className={styles.shell} role="status" aria-label="Loading your academy">
      <div className={styles.rail} aria-hidden="true">
        {railIcons.map((index) => (
          <span
            key={index}
            className={`${styles.skeleton} ${styles.railIcon} ${index === 0 ? styles.railIconActive : ''}`}
          />
        ))}
      </div>
      <div className={styles.main} aria-hidden="true">
        <div className={styles.topbar}>
          <div className={styles.topbarLeft}>
            <span className={`${styles.skeleton} ${styles.menuBtn}`} />
            <span className={`${styles.skeleton} ${styles.logo}`} />
          </div>
          <div className={styles.searchWrap}>
            <span className={`${styles.skeleton} ${styles.searchBar}`} />
          </div>
          <div className={styles.centerNav}>
            <span className={`${styles.skeleton} ${styles.navPill}`} />
            <span className={`${styles.skeleton} ${styles.navPill}`} />
            <span className={`${styles.skeleton} ${styles.navPillNarrow}`} />
          </div>
          <div className={styles.rightNav}>
            <span className={`${styles.skeleton} ${styles.iconBtn}`} />
            <span className={`${styles.skeleton} ${styles.iconBtn}`} />
            <span className={`${styles.skeleton} ${styles.calloutPill}`} />
            <span className={`${styles.skeleton} ${styles.pillOutline}`} />
            <span className={`${styles.skeleton} ${styles.pillSolid}`} />
          </div>
        </div>

        <div className={styles.content}>
          <div className={styles.dashboardHeader}>
            <div className={styles.profileCard}>
              <span className={`${styles.skeleton} ${styles.avatar}`} />
              <div className={styles.profileLines}>
                <span className={`${styles.skeleton} ${styles.line}`} />
                <span className={`${styles.skeleton} ${styles.lineShort}`} />
              </div>
            </div>
            <div className={styles.indicators}>
              {indicators.map((index) => (
                <div className={styles.indicator} key={index}>
                  <span className={`${styles.skeleton} ${styles.indicatorLabel}`} />
                  <span className={`${styles.skeleton} ${styles.indicatorValue}`} />
                </div>
              ))}
            </div>
            <div className={styles.notes}>
              <span className={`${styles.skeleton} ${styles.note}`} />
              <span className={`${styles.skeleton} ${styles.note}`} />
            </div>
          </div>

          <div className={styles.folderSection}>
            <div className={styles.tabs}>
              {tabs.map((index) => (
                <span
                  key={index}
                  className={`${styles.skeleton} ${index === 0 ? styles.tabActive : styles.tab}`}
                />
              ))}
            </div>
            <div className={styles.folderRow}>
              {folderCards.map((index) => (
                <span key={index} className={styles.folderCard} />
              ))}
            </div>
          </div>

          <div className={styles.courseGrid}>
            {courseCards.map((index) => (
              <div className={styles.courseCard} key={index}>
                <span className={`${styles.skeleton} ${styles.courseImage}`} />
                <div className={styles.courseBody}>
                  <span className={`${styles.skeleton} ${styles.courseEyebrow}`} />
                  <span className={`${styles.skeleton} ${styles.courseTitle}`} />
                  <span className={`${styles.skeleton} ${styles.courseDescription}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AppShellSkeleton;
