import SideNavigation from '@/components/side-navigation/SideNavigation';
import HomeLoader from '@/components/home-bento/HomeLoader';
import styles from './loading.module.css';

export default function DaoLoading() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.page}>
        <HomeLoader />
      </main>
    </div>
  );
}
