import SideNavigation from '@/components/side-navigation/SideNavigation';
import { DotmSquare15 } from '@/components/dot-matrix/DotmSquare15';
import styles from './loading.module.css';

export default function HomeLoading() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.page}>
        <div className={styles.loaderCard}>
          <DotmSquare15 speed={0.8} dotSize={7} gap={4} />
          <p className={styles.kicker}>Personal course builder</p>
          <h1 className={styles.title}>Opening your home space</h1>
          <p className={styles.text}>Blue is checking for your saved course and intake answers.</p>
        </div>
      </main>
    </div>
  );
}
