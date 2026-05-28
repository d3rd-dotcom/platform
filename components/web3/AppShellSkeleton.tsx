import styles from './AppShellSkeleton.module.css';

/**
 * Lightweight, dependency-free placeholder shown while the wallet provider
 * (Privy + wagmi) chunk loads. It renders OUTSIDE the Web3 context, so it must
 * not use any wallet hooks. Its job is to give the authenticated routes an
 * immediate, on-brand first paint instead of a blank screen while the heavy
 * wallet SDK downloads — a large FCP/LCP win on every gated route.
 */
export function AppShellSkeleton() {
  return (
    <div className={styles.shell} role="status" aria-label="Loading your academy">
      <div className={styles.rail} aria-hidden="true" />
      <div className={styles.main} aria-hidden="true">
        <div className={styles.topbar} />
        <div className={styles.content}>
          <span className={styles.pulse} />
        </div>
      </div>
    </div>
  );
}

export default AppShellSkeleton;
