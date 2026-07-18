import type { ReactNode } from 'react';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { LandingSoundEffects } from './LandingSoundEffects';
import styles from './LandingSubpageShell.module.css';

interface LandingSubpageShellProps {
  children: ReactNode;
}

export function LandingSubpageShell({ children }: LandingSubpageShellProps) {
  return (
    <div className={styles.container} data-landing-page>
      <LandingSoundEffects />
      <LandingHeader />
      <main className={styles.main}>{children}</main>
      <LandingFooter />
    </div>
  );
}
