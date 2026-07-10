import SideNavigation from '@/components/side-navigation/SideNavigation';
import styles from '../dao/loading.module.css';

export default function QuestsLoading() {
  return (
    <div className={styles.pageLayout}>
      <SideNavigation />
      <main className={styles.page} />
    </div>
  );
}
