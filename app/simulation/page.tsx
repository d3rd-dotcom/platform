'use client';

import SideNavigation from '@/components/side-navigation/SideNavigation';
import SimulationGate from './SimulationGate';
import styles from './simulation.module.css';

export default function SimulationPage() {
  return (
    <>
      <SideNavigation />
      <main className={styles.pageLayout}>
        <SimulationGate />
      </main>
    </>
  );
}
